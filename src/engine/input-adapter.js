import { CATEGORIES } from "./model.js";

// Stable input contract for the prototype. Metadata describes observations;
// purposeCatalog links observations to disclosed purpose; CMP is a separate choice signal.
export function buildGuestsFromInputs({ cookieMetadata, purposeCatalog = [], cmpSignal = null }) {
  if (!Array.isArray(cookieMetadata)) throw new TypeError("cookieMetadata must be an array.");
  if (!Array.isArray(purposeCatalog)) throw new TypeError("purposeCatalog must be an array.");
  const choices = cmpSignal?.status === "readable" && Array.isArray(cmpSignal.choices) ? cmpSignal.choices : [];
  return cookieMetadata.map((cookie, index) => {
    if (!cookie || typeof cookie.name !== "string" || typeof cookie.domain !== "string") {
      throw new TypeError(`Cookie metadata record ${index + 1} needs name and domain strings.`);
    }
    const mapping = purposeCatalog.find((entry) => entry.cookieName === cookie.name && entry.domain === cookie.domain);
    const mapped = mapping && CATEGORIES.includes(mapping.category);
    const choice = mapped && choices.find((entry) => entry.vendorId === mapping.vendorId && entry.purposeId === mapping.purposeId);
    const cmpDecision = choice && ["accept", "reject"].includes(choice.decision) ? choice.decision : null;
    const essential = mapped && mapping.category === "essential";
    const id = `cookie-${encodeURIComponent(cookie.name)}-${encodeURIComponent(cookie.domain)}`;
    return {
      id,
      name: mapped ? (mapping.guestName || mapping.vendorName || cookie.name) : `Unknown guest · ${cookie.name}`,
      category: mapped ? mapping.category : "unclassified",
      party: cookie.party === "third" || mapping?.party === "third" ? "third" : "first",
      vendor: mapping?.vendorName || cookie.vendor || cookie.domain,
      request: mapped ? mapping.request : "Purpose not verified. Review the site disclosure or leave this guest undecided.",
      metadata: {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path ?? "/",
        expires: cookie.expires ?? "session",
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite: cookie.sameSite ?? "unspecified",
        party: cookie.party ?? "unknown",
      },
      purposeEvidence: mapped ? (mapping.evidence || "site disclosure") : "unmapped",
      cmpDecision: essential ? null : cmpDecision,
      initialStatus: essential ? "inside" : cmpDecision === "accept" ? "inside" : cmpDecision === "reject" ? "left" : "pending",
    };
  });
}
