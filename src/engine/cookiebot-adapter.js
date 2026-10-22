import { buildGuestsFromInputs } from "./input-adapter.js";

const COOKIEBOT_CATEGORIES = {
  "1": { category: "essential", label: "necessary" },
  "2": { category: "functionality", label: "preferences" },
  "3": { category: "analytics", label: "statistics" },
  "4": { category: "advertising", label: "marketing" },
  necessary: { category: "essential", label: "necessary" },
  essential: { category: "essential", label: "necessary" },
  preferences: { category: "functionality", label: "preferences" },
  functionality: { category: "functionality", label: "preferences" },
  statistics: { category: "analytics", label: "statistics" },
  analytics: { category: "analytics", label: "statistics" },
  marketing: { category: "advertising", label: "marketing" },
  advertising: { category: "advertising", label: "marketing" },
};

const cleanDomain = (domain = "") => String(domain).trim().toLowerCase().replace(/^\.+/, "");
const slug = (value = "unknown") => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";

function categoryInfo(value) {
  return COOKIEBOT_CATEGORIES[String(value ?? "").trim().toLowerCase()] || null;
}

function expireDescription(row) {
  if (row.ExpireDescription) return String(row.ExpireDescription);
  if (row.Persistent === false) return "session";
  if (Number.isFinite(Number(row.ExpireDays)) && Number(row.ExpireDays) > 0) return `${row.ExpireDays} days`;
  if (Number.isFinite(Number(row.ExpireSeconds)) && Number(row.ExpireSeconds) > 0) return `${Math.round(Number(row.ExpireSeconds) / 86400)} days`;
  return "unknown";
}

/** Convert a public Cookiebot declaration (or compatible catalog) into purpose evidence. */
export function catalogFromCookiebotDetails(details) {
  if (!details || !Array.isArray(details.cookies)) throw new TypeError("Cookiebot details input must contain a cookies array.");
  return details.cookies.flatMap((row) => {
    if (!row?.Name) return [];
    const declaredName = String(row.Name).trim();
    const countMatch = declaredName.match(/\s*\[x\s*(\d+)\]\s*$/i);
    const cookieName = declaredName.replace(/\s*\[x\s*\d+\]\s*$/i, "").trim();
    if (!cookieName) return [];
    const info = categoryInfo(row.Category);
    // Public declarations may omit cookie domains. Leave them blank so the
    // downstream matcher can use a unique cookie-name match when safe.
    const domain = cleanDomain(row.Domain || row.Host || "");
    const provider = String(row.Provider || domain || "Unknown provider");
    const purpose = String(row.PurposeDescription || info?.label || "Purpose not described");
    return [{
      cookieName, declarationCount: Math.max(1, Number(row.DeclarationCount) || Number(countMatch?.[1]) || 1),
      domain, vendorId: slug(provider), purposeId: info?.label || slug(purpose),
      vendorName: provider, guestName: `${provider} · ${cookieName}`,
      category: info?.category || "unclassified", party: typeof row.ThirdParty === "boolean" ? (row.ThirdParty ? "third" : "first") : undefined,
      request: purpose,
      evidence: details.source === "public-declaration" ? "public Cookiebot declaration" : "Cookiebot cookie-purpose catalog",
      sourceCategory: row.Category ?? null, expire: expireDescription(row),
    }];
  });
}

/** Convert Chrome cookies.getAll() records into value-free cookie metadata. */
export function metadataFromChromeCookies(cookies, siteDomain) {
  if (!Array.isArray(cookies)) throw new TypeError("Chrome cookies input must be an array.");
  const site = cleanDomain(siteDomain);
  return cookies.map((cookie, index) => {
    if (!cookie || typeof cookie.name !== "string" || typeof cookie.domain !== "string") {
      throw new TypeError(`Chrome cookie record ${index + 1} needs name and domain strings.`);
    }
    const domain = cleanDomain(cookie.domain);
    const firstParty = Boolean(site && (domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`)));
    return {
      name: cookie.name, domain, path: cookie.path || "/",
      expires: cookie.session || !Number.isFinite(cookie.expirationDate)
        ? "session"
        : new Date(cookie.expirationDate * 1000).toISOString().slice(0, 10),
      secure: Boolean(cookie.secure), httpOnly: Boolean(cookie.httpOnly),
      sameSite: ({ no_restriction: "None", lax: "Lax", strict: "Strict", unspecified: "unspecified" })[cookie.sameSite] || "unspecified",
      party: firstParty ? "first" : "third",
      // Deliberately omit cookie.value: it is sensitive and is not needed for preference extraction.
    };
  });
}

/** Convert a Cookiebot browser SDK consent snapshot into category-level choices. */
export function cmpFromCookiebotSdk(snapshot) {
  const consent = snapshot?.consent;
  if (!consent || typeof consent !== "object" || snapshot.hasResponse !== true) {
    return { status: "not_readable", format: "Cookiebot JavaScript SDK", choices: [] };
  }
  const keys = ["preferences", "statistics", "marketing"];
  return {
    status: "readable", format: "Cookiebot JavaScript SDK", method: snapshot.method || consent.method || "unknown",
    choices: keys.filter((key) => typeof consent[key] === "boolean").map((key) => ({
      category: COOKIEBOT_CATEGORIES[key].category, decision: consent[key] ? "accept" : "reject",
    })),
  };
}

/** Normalize all three raw vendor/browser inputs, then build the existing scenario guests. */
export function buildGuestsFromCookiebotInputs({ chromeCookies, siteDomain, cookiebotDetails, cookiebotSdk }) {
  const cookieMetadata = metadataFromChromeCookies(chromeCookies, siteDomain);
  const purposeCatalog = catalogFromCookiebotDetails(cookiebotDetails);
  const cmpSignal = cmpFromCookiebotSdk(cookiebotSdk);
  return { cookieMetadata, purposeCatalog, cmpSignal, guests: buildGuestsFromInputs({ cookieMetadata, purposeCatalog, cmpSignal }) };
}
