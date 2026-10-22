import { CATEGORIES } from "./model.js";

const PURPOSE_ANALOGIES = {
  essential: { title: "Door keeper", description: "a doorkeeper keeping the basic service working" },
  authentication: { title: "Visit-pass keeper", description: "a pass keeper helping the site recognize a returning visitor" },
  functionality: { title: "Settings notebook", description: "a notebook remembering settings or details you chose" },
  analytics: { title: "Room counter", description: "a counter noting which rooms visitors use so the host can understand what is popular" },
  advertising: { title: "Recommendation messenger", description: "a messenger carrying information used to tailor advertisements" },
  basket: { title: "Basket keeper", description: "a basket keeper holding the items you gathered while browsing" },
};

function metadataClues(metadata) {
  const party = metadata.party === "first" ? "first-party" : metadata.party === "third" ? "third-party" : "party not identified";
  const path = metadata.path && metadata.path !== "/" ? ` It is limited to path ${metadata.path}.` : "";
  return `The browser saw cookie ${metadata.name} on ${metadata.domain || "an unidentified domain"}; it is ${party}, lasts ${metadata.expires || "an unknown period"}, is ${metadata.secure ? "marked Secure" : "not marked Secure"}, is ${metadata.httpOnly ? "marked HttpOnly" : "not marked HttpOnly"}, and has SameSite set to ${metadata.sameSite || "unspecified"}.${path}`;
}

function analogyForPurpose(category, requestText) {
  if (PURPOSE_ANALOGIES[category]) return PURPOSE_ANALOGIES[category];
  const text = requestText.toLowerCase();
  if (/cart|basket|shopping/.test(text)) return PURPOSE_ANALOGIES.basket;
  if (/session|login|log in|authenticat|sign.?in|identity/.test(text)) return PURPOSE_ANALOGIES.authentication;
  if (/statistic|analytic|measure|count|visit|page view|performance/.test(text)) return PURPOSE_ANALOGIES.analytics;
  if (/advertis|marketing|target|personaliz|track.*activity/.test(text)) return PURPOSE_ANALOGIES.advertising;
  if (/prefer|setting|remember|format|language|device/.test(text)) return PURPOSE_ANALOGIES.functionality;
  return null;
}

function scenarioRequest({ metadata, mapping, requestText, hasPurposeEvidence, analogy }) {
  if (!hasPurposeEvidence) {
    return `An unnamed guest is at the door. We do not have a verified purpose for this cookie. ${metadataClues(metadata)} These details describe how the browser stores it, not what the guest intends to do. Would you let this guest in despite the uncertainty?`;
  }
  const source = mapping.evidence === "public Cookiebot declaration" ? "The public declaration" : "The cookie-purpose record";
  if (analogy) {
    const categoryNote = CATEGORIES.includes(mapping.category) ? "" : " The declaration does not provide a recognized category, so this remains an individual choice.";
    return `Imagine this guest as ${analogy.description}. ${source} says: “${requestText}”${categoryNote} Would you let this guest use the house?`;
  }
  return `A guest arrives with a written purpose but no recognized category label. ${source} says: “${requestText}” Would you let this guest use the house?`;
}

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
    const sameNameMappings = purposeCatalog.filter((entry) => entry.cookieName === cookie.name);
    const exactMappings = sameNameMappings.filter((entry) => entry.domain === cookie.domain);
    const sameNameObservations = cookieMetadata.filter((entry) => entry.name === cookie.name);
    const oneDeclarationCoversObservedGroup = sameNameMappings.length === 1 &&
      sameNameMappings[0].declarationCount >= sameNameObservations.length;
    const mapping = exactMappings.length === 1
      ? exactMappings[0]
      : exactMappings.length === 0 && sameNameMappings.length === 1 &&
        (sameNameObservations.length === 1 || oneDeclarationCoversObservedGroup)
        ? sameNameMappings[0]
        : null;
    const requestText = typeof mapping?.request === "string" ? mapping.request.trim() : "";
    const hasPurposeEvidence = Boolean(mapping && requestText && !/^purpose not described(?:\b|$)/i.test(requestText));
    const classified = hasPurposeEvidence && CATEGORIES.includes(mapping.category);
    const analogy = hasPurposeEvidence ? analogyForPurpose(mapping.category, requestText) : null;
    const choice = classified && choices.find((entry) =>
      (entry.category && entry.category === mapping.category) ||
      (entry.vendorId === mapping.vendorId && entry.purposeId === mapping.purposeId));
    const cmpDecision = choice && ["accept", "reject"].includes(choice.decision) ? choice.decision : null;
    const essential = classified && mapping.category === "essential";
    const id = `cookie-${encodeURIComponent(cookie.name)}-${encodeURIComponent(cookie.domain)}-${encodeURIComponent(cookie.path || "/")}`;
    const guestMetadata = {
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path ?? "/",
      expires: cookie.expires ?? "session",
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      sameSite: cookie.sameSite ?? "unspecified",
      party: cookie.party ?? "unknown",
    };
    return {
      id,
      name: hasPurposeEvidence
        ? `${analogy?.title || "Guest with a written purpose"} · ${cookie.name}`
        : `Unnamed guest · ${cookie.name}`,
      category: classified ? mapping.category : "unclassified",
      party: mapping?.party === "third" || mapping?.party === "first" ? mapping.party : cookie.party || "unknown",
      vendor: mapping?.vendorName || cookie.vendor || cookie.domain,
      request: scenarioRequest({ metadata: guestMetadata, mapping, requestText, hasPurposeEvidence, analogy }),
      metadata: guestMetadata,
      purposeDescription: hasPurposeEvidence ? requestText : null,
      purposeEvidence: hasPurposeEvidence ? (mapping.evidence || "site disclosure") : "unmapped",
      cmpDecision: essential ? null : cmpDecision,
      initialStatus: essential ? "inside" : cmpDecision === "accept" ? "inside" : cmpDecision === "reject" ? "left" : "pending",
    };
  });
}
