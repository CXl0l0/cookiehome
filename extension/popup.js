const APP = "http://localhost:3000";
const $ = (id) => document.getElementById(id);
const status = (message) => { $("status").textContent = message; };
const COOKIE_FIELDS = ["Name", "Provider", "Path", "HTTPOnly", "Secure", "ThirdParty", "Persistent", "ExpireSeconds", "ExpireDays", "ExpireDescription", "TrackerTypeName", "Category", "PurposeDescription", "Domain", "Host", "DeclarationCount"];
let scanDomain = "";
let scanDetails = null;
let providerHosts = [];
let scannedTab = null;

function inspectPublicDeclarationPage() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const categoryFromText = (value) => {
    const text = clean(value).toLowerCase();
    if (/necessary|essential/.test(text)) return "necessary";
    if (/preferences|functionality/.test(text)) return "preferences";
    if (/statistics|analytics/.test(text)) return "statistics";
    if (/marketing|advertising/.test(text)) return "marketing";
    return "";
  };
  const declarationTables = [];
  const tables = [...document.querySelectorAll("table")];
  for (const table of tables) {
    const headerRow = table.querySelector("thead tr") || [...table.querySelectorAll("tr")].find((row) => row.querySelector("th"));
    if (!headerRow) continue;
    const headers = [...headerRow.querySelectorAll("th,td")].map((cell) => clean(cell.innerText || cell.textContent).toLowerCase());
    const index = (pattern) => headers.findIndex((header) => pattern.test(header));
    const nameIndex = index(/name|cookie/);
    const providerIndex = index(/provider|host/);
    const domainIndex = index(/cookie\s*domain|^domain$/);
    const purposeIndex = index(/purpose|description/);
    if (nameIndex < 0 || purposeIndex < 0) continue;

    const section = table.closest(".CookieDeclarationType") || table.closest(".CookieDeclaration") || table.parentElement;
    const sectionHeading = section?.querySelector("h1,h2,h3,h4");
    let category = categoryFromText(sectionHeading?.innerText || "");
    if (!category) {
      let previous = table.previousElementSibling;
      for (let depth = 0; previous && depth < 6 && !category; depth += 1, previous = previous.previousElementSibling) {
        if (/^H[1-4]$/.test(previous.tagName)) category = categoryFromText(previous.innerText);
      }
    }

    const rows = [...table.querySelectorAll("tr")].filter((row) => row !== headerRow && row.querySelector("td"));
    for (const row of rows) {
      const cells = [...row.querySelectorAll("td")].map((cell) => clean(cell.innerText || cell.textContent));
      const declarationName = cells[nameIndex] || "";
      const countMatch = declarationName.match(/\s*\[x\s*(\d+)\]\s*$/i);
      const name = declarationName.replace(/\s*\[x\s*\d+\]\s*$/i, "").trim();
      if (!name) continue;
      const categoryIndex = index(/categor(y|ies)/);
      declarationTables.push({
        Name: name,
        DeclarationCount: countMatch ? Number(countMatch[1]) : 1,
        Provider: cells[providerIndex] || "",
        Domain: domainIndex >= 0 ? cells[domainIndex] || "" : "",
        PurposeDescription: cells[purposeIndex] || "Purpose not described in the public declaration.",
        ExpireDescription: cells[index(/expir|duration|retention/)] || "",
        TrackerTypeName: cells[index(/type/)] || "",
        Category: (categoryIndex >= 0 && cells[categoryIndex]) || category,
      });
    }
  }

  const seen = new Set();
  const cookies = declarationTables.filter((row) => {
    const key = [row.Name, row.Provider, row.Category, row.PurposeDescription].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2000);
  const policyLinks = [...document.querySelectorAll("a[href]")].map((anchor) => {
    const label = clean(anchor.innerText || anchor.getAttribute("aria-label"));
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (!/(cookie|privacy|data[- ]protection)/i.test(`${label} ${url.pathname}`)) return null;
      url.hash = "";
      return { url: url.href, label };
    } catch { return null; }
  }).filter(Boolean);
  const uniqueLinks = [...new Map(policyLinks.map((link) => [link.url, link])).values()]
    .sort((left, right) => {
      const score = (item) => /declaration|cookie.?policy|cookies/i.test(`${item.label} ${item.url}`) ? 2 : 1;
      return score(right) - score(left);
    }).slice(0, 8);
  const lastUpdated = clean(document.querySelector(".CookieDeclarationLastUpdated")?.innerText || "");
  return {
    url: location.href,
    language: document.documentElement.lang || "default",
    cookies,
    policyLinks: uniqueLinks,
    lastUpdated,
    hasCookieDeclarationScript: [...document.scripts].some((script) => /\/cd\.js(?:\?|$)/i.test(script.src || "")),
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

function sameSite(left, right) {
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url) throw new Error("Open the website you want to collect from, then reopen this extension.");
  const url = new URL(tab.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Cookie Homes can collect only from an HTTP or HTTPS website.");
  return { tab, url };
}

function originPattern(url) {
  return `${url.protocol}//${url.hostname}/*`;
}

async function inspectTab(tabId) {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: inspectPublicDeclarationPage });
  return injection?.result || { cookies: [], policyLinks: [] };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTab(tabId, timeoutMs = 5000, signal = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) return false;
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return true;
    await delay(200);
  }
  throw new Error("The cookie-policy page took too long to load.");
}

function declarationCandidates(page, pageUrl, manualUrl) {
  const origin = new URL(pageUrl).origin;
  const candidates = [];
  if (manualUrl) {
    const manual = new URL(manualUrl, pageUrl);
    if (manual.origin !== origin) throw new Error("For safety, the declaration page must be on the same site as the active tab.");
    candidates.push({ url: manual.href, label: "Provided declaration page" });
  }
  candidates.push(...(page.policyLinks || []));
  for (const path of ["/cookie-policy", "/cookies", "/privacy-policy", "/privacy/cookies", "/legal/cookies"]) {
    candidates.push({ url: new URL(path, origin).href, label: "Common cookie-policy path" });
  }
  return [...new Map(candidates.filter((item) => new URL(item.url).origin === origin).map((item) => [item.url, item])).values()]
    .filter((item) => item.url !== pageUrl).slice(0, 6);
}

async function readCandidateDeclaration(candidate, signal) {
  let tempTabId = null;
  try {
    if (signal.aborted) return null;
    const tab = await chrome.tabs.create({ url: candidate.url, active: false });
    tempTabId = tab.id;
    if (signal.aborted) return null;
    await waitForTab(tempTabId, 5000, signal);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (signal.aborted) return null;
      const page = await inspectTab(tempTabId);
      if (page.cookies?.length) return page;
      if (attempt < 2) await delay(300);
    }
    return null;
  } catch {
    return null;
  } finally {
    if (tempTabId !== null) await chrome.tabs.remove(tempTabId).catch(() => {});
  }
}

function findFirstDeclaration(candidates) {
  if (!candidates.length) return Promise.resolve(null);
  const controller = new AbortController();
  return new Promise((resolve) => {
    let remaining = candidates.length;
    let found = false;
    for (const candidate of candidates) {
      readCandidateDeclaration(candidate, controller.signal).then((page) => {
        if (page && !found) {
          found = true;
          controller.abort();
          resolve({ candidate, page });
        }
      }).finally(() => {
        remaining -= 1;
        if (remaining === 0 && !found) resolve(null);
      });
    }
  });
}

async function findDeclaration() {
  const button = $("find-declaration");
  button.disabled = true;
  $("scan-summary").hidden = true;
  try {
    const { tab, url } = await activeTab();
    scanDomain = url.hostname.toLowerCase();
    scannedTab = { id: tab.id, url: tab.url, origin: url.origin };
    $("active-site").textContent = url.hostname;
    status("Requesting permission to inspect this site’s public pages…");
    const granted = await chrome.permissions.request({ origins: [originPattern(url)] });
    if (!granted) throw new Error("Site access was not granted. No site data was collected.");

    status("Looking for a published Cookiebot declaration on this page…");
    let page = await inspectTab(tab.id);
    let declarationUrl = page.cookies?.length ? page.url : "";
    const manualUrl = $("declaration-url").value.trim();
    if (!declarationUrl) {
      const candidates = declarationCandidates(page, tab.url, manualUrl);
      if (candidates.length) {
        status(`Checking ${candidates.length} likely public pages together. If no declaration is found, browser metadata and the CMP remain available as fallback…`);
        const match = await findFirstDeclaration(candidates);
        if (match) {
          page = match.page;
          declarationUrl = match.candidate.url;
        }
      }
    }

    const rows = (page.cookies || []).map((row) => {
      const declaredDomain = providerHost(row.Domain || row.Host);
      const result = { ...row, Domain: declaredDomain };
      if (declaredDomain) result.ThirdParty = !sameSite(declaredDomain, scanDomain);
      return Object.fromEntries(COOKIE_FIELDS.filter((key) => result[key] !== undefined).map((key) => [key, result[key]]));
    });
    scanDetails = {
      domain: scanDomain,
      culture: page.language || "default",
      source: rows.length ? "public-declaration" : "not-found",
      declarationUrl: declarationUrl || "",
      lastUpdated: page.lastUpdated || "",
      cookies: rows,
    };
    providerHosts = [...new Set(rows.map((row) => providerHost(row.Domain || row.Host || row.Provider)).filter((host) => host && !sameSite(host, scanDomain)))].slice(0, 24);
    const summary = rows.length
      ? `Found ${rows.length} entries in the public declaration at ${new URL(declarationUrl).pathname}. Access may be requested for the site and ${providerHosts.length} provider domains.`
      : "No public Cookiebot declaration was found. The extension can still collect browser metadata and the SDK; cookies without a disclosure match will stay unknown.";
    $("scan-info").textContent = summary;
    $("scan-summary").hidden = false;
    status(rows.length ? "Declaration ready. Continue to collect the browser inputs." : "Fallback ready. Continue to collect available browser inputs.");
  } catch (error) {
    status(error.message);
  } finally { button.disabled = false; }
}

function permissionOrigins(hosts) {
  return [...new Set(hosts.flatMap((host) => [`https://${host}/*`, `http://${host}/*`]))];
}

function cookieDomainMatches(cookieDomain, host) {
  const domain = String(cookieDomain || "").toLowerCase().replace(/^\.+/, "");
  return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
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
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
      return capture();
    },
  });
  return injection?.result || {
    hasResponse: false, consented: false, declined: false,
    consent: { necessary: true, preferences: false, statistics: false, marketing: false, method: null },
  };
}

async function collect() {
  const button = $("collect");
  button.disabled = true;
  try {
    const tab = scannedTab;
    if (!tab || !scanDetails) throw new Error("Find the public declaration first.");
    const grantHosts = [...new Set([scanDomain, ...providerHosts])];
    status(`Chrome will ask for access to the site and up to ${providerHosts.length} provider domains.`);
    const granted = await chrome.permissions.request({ origins: permissionOrigins(grantHosts) });
    if (!granted) throw new Error("Site access was not granted. No cookie data was collected.");
    const currentTab = await chrome.tabs.get(tab.id);
    if (currentTab.url !== tab.url) throw new Error("The active site changed. Find the declaration again for this tab.");

    const rows = [];
    const seen = new Set();
    const add = (cookie) => {
      const safe = safeCookie(cookie);
      const key = `${safe.storeId || "0"}|${safe.domain}|${safe.path}|${safe.name}|${JSON.stringify(safe.partitionKey || null)}`;
      if (!seen.has(key)) { seen.add(key); rows.push(safe); }
    };
    for (const cookie of await chrome.cookies.getAll({ url: currentTab.url })) add(cookie);
    for (const host of providerHosts) {
      const names = new Set(scanDetails.cookies.filter((row) => providerHost(row.Domain || row.Host || row.Provider) === host).map((row) => row.Name));
      if (!names.size) continue;
      for (const cookie of await chrome.cookies.getAll({ domain: host })) {
        if (names.has(cookie.name) && cookieDomainMatches(cookie.domain, host)) add(cookie);
      }
    }

    status("Reading the site’s current Cookiebot consent snapshot…");
    const cookiebotSdk = await cookiebotSnapshot(currentTab.id);
    status("Sending value-free metadata and public declaration rows to Cookie Homes…");
    const response = await fetch(`${APP}/api/input-scenarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteDomain: scanDomain, chromeCookies: rows, cookiebotSdk, cookiebotDetails: scanDetails }),
    });
    const handoff = await response.json();
    if (!response.ok) throw new Error(handoff.error || `Could not create the scenario (${response.status}).`);
    await chrome.tabs.create({ url: `${APP}/input-demo.html?scenario=${encodeURIComponent(handoff.token)}`, active: true });
    const declarationMessage = scanDetails.cookies.length ? `${scanDetails.cookies.length} public declaration entries` : "no public declaration entries";
    status(`Collected ${rows.length} cookie metadata records, ${declarationMessage}, and the available CMP snapshot. Cookie values were removed.`);
  } catch (error) {
    status(error.message);
  } finally { button.disabled = false; }
}

$("find-declaration").addEventListener("click", findDeclaration);
$("collect").addEventListener("click", collect);
activeTab().then(({ url }) => { $("active-site").textContent = url.hostname; }).catch((error) => { $("active-site").textContent = error.message; });
