---
version: 2
slug: "src-features-public-tracking-tracking-form-tsx"
primary_target: "src/features/public-tracking/tracking-form.tsx"
related_targets: ["src/features/public-tracking/result.tsx","src/features/public-tracking/timeline.tsx","src/features/public-tracking/skeleton.tsx","src/features/public-tracking/public-tracking.css","src/features/public-tracking/use-tracking.ts","src/app/(public)/track/page.tsx","src/app/(public)/track/loading.tsx","src/app/(public)/track/error.tsx"]
---

# Public shipment tracking

Mode: Operate. This brief applies to `/track` and the public-tracking feature, extending the accepted `/order` visual language. Root `PRODUCT.md`, `DESIGN.md`, the global sidecar and the earlier Order brief remain historical visual authority; this authorized phase adds tracking without replacing the identity.

Status: Implemented and accepted for ship on 2026-09-14 (Africa/Tripoli). The independent finish reviewer returned `ship`, with no material visual or UX findings after viewing all 40 final screenshots and reviewing source. The reviewer did not perform firsthand interaction. Acceptance is local; no deployment is claimed.

Audience and task: Arabic-speaking shipment customers using a phone in everyday settings. Enter or open a tracking number, read the authoritative current state and public history, then copy the number or deliberately refresh.

THESIS: One labelled search leads to one readable shipment result. The current status leads; identity, public shipment details and the vertical history follow in a stable reading order.

OWN-WORLD: Reuse Cairo, restrained teal actions, neutral light/dark surfaces and thin borders from the public Order page. Keep Arabic RTL, isolated LTR identifiers, visible focus and roomier public controls. No new logo, raster imagery, marketing composition or palette.

STORY: Search explicitly or open a validated identifier-only link. Recognize the current state immediately, confirm route and shipment type, inspect public events, then refresh manually. A refresh failure retains the last successful result for that same number with an explicit explanation.

FIRST VIEWPORT: The existing text wordmark header and compact Arabic introduction lead directly to the tracking label, input, search button and help. Content caps at 800px. Search controls stack on phones and share a row from 600px. The result remains one column; its compact details use two wrapping columns. The status heading precedes the tracking number and copy action.

FORM: Precisely specified extension within the established visual world. The source implementation is the record of truth. No open identity or composition decision required a new concept round or raster assets.

Memorable interaction: A valid new result focuses its status heading. Editing another identifier hides the old result and cancels obsolete work; typing itself does not search. Refresh keeps button focus and does not replay the result entrance. Copy announces success or offers manual selection. A short result entrance and refresh-icon rotation run only when reduced motion is not requested.

Public boundary: Use only the approved anonymous tracking GET through the centralized client and strict response validation. Show the tracking number, mapped current status, public city names, shipment type, creation time, optional labelled delivery estimate and timeline statuses/times. Preserve the API array order exactly and display times in Africa/Tripoli. Do not infer missing events, lifecycle transitions, an update timestamp, office/contact details, payment data or private identities.

State contract: Keep persistent labels and safe Arabic validation, not-found, rate-limit, service/network and route-error feedback. A readable Retry-After establishes a visible cooldown; expiration never triggers a request. No automatic polling, background refresh or retries. Tracking identifiers/results stay in URL and memory; no recent-search feature or persistent customer data. The existing order confirmation links to the validated `/track?number=...` URL without changing submission behavior.

FINISH: `reports/public-tracking/visual/results.json` is PASS: 40 captures across light 390, 430, 768, 1024 and 1440px plus dark 390px. Each configuration covers empty, loading, success, delivered, not-found and service error; four additional mobile captures cover intermediate statuses. The record reports no overflow or axe violations, 16px inputs, actions at least 48px and a 44px brand target. The one mechanical detector pass returned an empty finding list.

Supporting evidence: All 42 browser tests and 203 unit tests passed. Separate read-only live acceptance passed with exactly two public GETs against the retained synthetic QA order, covering lookup and manual refresh without a new order or status mutation. Evidence and full performance details remain in `docs/PUBLIC-TRACKING-IMPLEMENTATION-REPORT.md`.

Unresolved decisions: None for this presentation. Physical-device, manual screen-reader and production field-performance checks were not performed. Local screenshots, automated accessibility and lab performance do not establish deployment behavior. Driver app, GPS/maps, polling, lifecycle discovery and payment processing remain outside this surface. See `docs/PUBLIC-TRACKING-DESIGN.md` for the scoped design record.
