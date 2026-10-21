const APP = "http://localhost:3000";
const $ = (id) => document.getElementById(id);
const status = (message) => { $("status").textContent = message; };
const COOKIE_FIELDS = ["Name", "Provider", "Path", "HTTPOnly", "Secure", "ThirdParty", "Persistent", "ExpireSeconds", "ExpireDays", "ExpireDescription", "TrackerTypeName", "Category", "PurposeDescription", "Domain", "Host"];
let scanDomain = "";
let scanDetails = null;
let providerHosts = [];
let scannedTab = null;

function sanitizeDetails(input) {
  if (!input || !Array.isArray(input.cookies)) throw new Error("Cookiebot’s scan response did not contain a cookies list.");
  return {
    domain: input.domain || scanDomain,
    culture: input.culture || "default",
    cookies: input.cookies.map((row) => Object.fromEntries(COOKIE_FIELDS.filter((key) => row?.[key] !== undefined).map((key) => [key, row[key]]))),
  };
}

function providerHost(value) {
  const raw = String(value || "").trim();
  if (!raw || /\s/.test(raw)) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = url.hostname.toLowerCase().replace(/^\.+|\.+$/g, "");
    return hostname.includes(".") && !hostname.includes("..") ? hostname : "";
  } catch { return ""; }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url) throw new Error("Open the website you want to collect from, then reopen this extension.");
  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Cookie Homes can collect only from an HTTP or HTTPS website.");
  return { tab, url };
}

async function loadScan() {
  const button = $("load-scan");
  button.disabled = true;
  $("scan-summary").hidden = true;
  try {
    const { tab, url } = await activeTab();
    scanDomain = url.hostname.toLowerCase();
    scannedTab = { id: tab.id, url: tab.url };
    $("active-site").textContent = url.hostname;
    status("Requesting the Cookiebot scan from the local backend…");
    const response = await fetch(`${APP}/api/cookiebot/details?domain=${encodeURIComponent(scanDomain)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Cookiebot details request failed (${response.status}).`);
    scanDetails = sanitizeDetails(result);
    providerHosts = [...new Set(scanDetails.cookies.map((row) => providerHost(row.Domain || row.Host || row.Provider)).filter((host) => host && host !== scanDomain))].slice(0, 24);
    $("scan-info").textContent = `Loaded ${scanDetails.cookies.length} scanned cookie entries for ${scanDomain}. Collection may request access to the site and up to ${providerHosts.length} cookie-provider domains.`;
    $("scan-summary").hidden = false;
    status("Scan loaded. Continue to review the browser permission prompt.");
  } catch (error) {
    status(error.message);
  } finally { button.disabled = false; }
}

function permissionOrigins(hosts) {
  return [...new Set(hosts.flatMap((host) => [`https://${host}/*`, `http://${host}/*`]))];
}

function cookieDomainMatches(cookieDomain, host) {
  const domain = String(cookieDomain || "").toLowerCase().replace(/^\.+/, "");
  return domain === host || domain.endsWith(`.${host}`);
}

function safeCookie(cookie) {
  const result = {};
  for (const key of ["name", "domain", "path", "expirationDate", "secure", "httpOnly", "sameSite", "session", "hostOnly", "storeId", "partitionKey"]) {
    if (cookie[key] !== undefined) result[key] = cookie[key];
  }
  return result;
}

async function cookiebotSnapshot(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN",
    func: async () => {
      const capture = () => {
        const bot = window.Cookiebot;
        if (!bot?.consent) return null;
        return {
          hasResponse: bot.hasResponse === true,
          consented: bot.consented === true,
          declined: bot.declined === true,
          consent: {
            necessary: bot.consent.necessary === true,
            preferences: typeof bot.consent.preferences === "boolean" ? bot.consent.preferences : false,
            statistics: typeof bot.consent.statistics === "boolean" ? bot.consent.statistics : false,
            marketing: typeof bot.consent.marketing === "boolean" ? bot.consent.marketing : false,
            method: bot.consent.method ?? null,
          },
        };
      };
      const current = capture();
      if (current) return current;
      await Promise.race([
        new Promise((resolve) => window.addEventListener("CookiebotOnConsentReady", resolve, { once: true })),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      return capture();
    },
  });
  if (!injection?.result) throw new Error("Cookiebot’s browser SDK was not found on this page. Confirm the site uses Cookiebot and wait for its banner to load.");
  return injection.result;
}

async function collect() {
  const button = $("collect");
  button.disabled = true;
  try {
    // Keep the permission request as the first async action so Chrome sees the button click as its user gesture.
    const tab = scannedTab;
    if (!tab) throw new Error("Load the Cookiebot scan first.");
    const url = new URL(tab.url);
    if (url.hostname.toLowerCase() !== scanDomain) throw new Error("The active site changed after the scan loaded. Load the scan again for this tab.");
    const grantHosts = [...new Set([scanDomain, ...providerHosts])];
    status(`Chrome will ask for access to ${grantHosts.length} site domain${grantHosts.length === 1 ? "" : "s"}.`);
    const permissionRequest = chrome.permissions.request({ origins: permissionOrigins(grantHosts) });
    const granted = await permissionRequest;
    if (!granted) throw new Error("Site access was not granted. No cookie data was collected.");
    const currentTab = await chrome.tabs.get(tab.id);
    if (currentTab.url !== tab.url) throw new Error("The tab navigated after the scan loaded. Load the scan again for the current page.");

    const rows = [];
    const seen = new Set();
    const add = (cookie) => {
      const safe = safeCookie(cookie);
      const key = `${safe.storeId || "0"}|${safe.domain}|${safe.path}|${safe.name}|${JSON.stringify(safe.partitionKey || null)}`;
      if (!seen.has(key)) { seen.add(key); rows.push(safe); }
    };
    // Collect cookies relevant to the current page, then scanned provider cookies by domain/name.
    for (const cookie of await chrome.cookies.getAll({ url: currentTab.url })) add(cookie);
    for (const host of providerHosts) {
      const names = new Set(scanDetails.cookies.filter((row) => providerHost(row.Domain || row.Host || row.Provider) === host).map((row) => row.Name));
      if (!names.size) continue;
      for (const cookie of await chrome.cookies.getAll({ domain: host })) {
        if (names.has(cookie.name) && cookieDomainMatches(cookie.domain, host)) add(cookie);
      }
    }

    status("Reading Cookiebot’s current consent snapshot…");
    const cookiebotSdk = await cookiebotSnapshot(currentTab.id);
    status("Sending value-free metadata to the local Cookie Homes app…");
    const response = await fetch(`${APP}/api/input-scenarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteDomain: scanDomain, chromeCookies: rows, cookiebotSdk, cookiebotDetails: scanDetails }),
    });
    const handoff = await response.json();
    if (!response.ok) throw new Error(handoff.error || `Could not create the scenario (${response.status}).`);
    await chrome.tabs.create({ url: `${APP}/input-demo.html?scenario=${encodeURIComponent(handoff.token)}`, active: true });
    status(`Collected ${rows.length} cookie metadata records. Cookie values were removed. The input demo is opening for review.`);
  } catch (error) {
    status(error.message);
  } finally { button.disabled = false; }
}

$("load-scan").addEventListener("click", loadScan);
$("collect").addEventListener("click", collect);
activeTab().then(({ url }) => { $("active-site").textContent = url.hostname; }).catch((error) => { $("active-site").textContent = error.message; });
