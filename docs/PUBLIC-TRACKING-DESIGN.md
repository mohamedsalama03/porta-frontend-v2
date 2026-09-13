# Public tracking design record

## Overview

Public Tracking is an Operate surface for Arabic-speaking customers checking a shipment on a phone. Its task is direct: enter or open a tracking number, recognize the current status, inspect public history and refresh deliberately. It extends the accepted Public Order visual language with Cairo, restrained teal, neutral surfaces and thin borders. The precise established-world brief required no identity workshop, concept round, logo or raster assets.

This record is scoped to `/track` and its [surface brief](../.impeccable/surfaces/src-features-public-tracking-tracking-form-tsx.md). It does not revise root `PRODUCT.md`, `DESIGN.md`, the global sidecar or the earlier Order brief. Those documents describe the earlier approved phases; this phase now supplies the real tracking destination from Order confirmation.

Accepted for ship on 14 September 2026 (Africa/Tripoli). The independent finish reviewer viewed all 40 final screenshots and reviewed source, returning `ship` with no material visual or UX findings. That review was based on screenshots and source, not firsthand interaction.

The [visual matrix](../reports/public-tracking/visual/results.json) passed with 40 captures: light at 390, 430, 768, 1024 and 1440px, plus dark at 390px. Empty, loading, success, delivered, not-found and service error appear in each configuration; four additional mobile captures cover intermediate status enums. The matrix reports no horizontal overflow or axe violations. The [single mechanical detector pass](../reports/public-tracking/design-detector.json) returned no findings.

All 42 browser tests and 203 unit tests passed. Separate [live acceptance](../reports/public-tracking/live/acceptance.json) verified lookup and refresh through exactly two public GETs using the retained synthetic QA shipment; no new order or status change was made. These are local acceptance results. Physical-device and manual screen-reader testing, field performance and deployment behavior were not measured. The [implementation report](PUBLIC-TRACKING-IMPLEMENTATION-REPORT.md) owns detailed integration, regression and performance evidence.

## Colors

The surface inherits the shared light/dark tokens. Restrained teal identifies the main search action and timeline markers. Neutral surface tones and thin borders separate identity, details and history. Delivered uses the existing semantic success color together with completion text and an icon, so color is not the sole signal. Muted text supports help, dates and secondary labels without competing with the current status.

## Typography

Cairo remains the shared Arabic typeface. The public shell uses body text (15px) and a compact page heading (28px). The current status is the result heading (24px); history uses a smaller section heading (18px). Native input text stays readable (16px). The tracking identifier uses bold text (18px on phones, 20px from 600px) and an isolated left-to-right direction inside the RTL page.

Public detail values use compact text (14px), with supporting labels and timestamps smaller. Long identifiers, city/type labels and timestamps wrap within their containers. Dates use the existing Africa/Tripoli formatter and semantic time elements; the history explicitly identifies Libya time.

## Layout

The tracking main region caps at 800px within the shared public shell. Side margins are 16px on phones and 32px from 768px. A compact introduction leads directly into the persistent tracking label, input, explicit search action and help text. Search controls stack below 600px and share a row above it; searching does not occur while typing.

The result follows the form in a single column, with current status first, then identity/copy, public shipment details, history and manual refresh. Details use two columns with wrapping values. The vertical timeline uses the RTL inline edge and preserves the exact API array order. It is a record of received events, not a predicted progress stepper.

Result and skeleton padding is 24px vertically and 20px horizontally on narrow screens, increasing to 28px and 32px from 600px. The empty state is quiet explanatory text below a divider; the loading skeleton reserves a substantial result area. The copy feedback line reserves space so feedback does not shift surrounding content unnecessarily.

## Elevation & Depth

Surface tones and borders provide separation without new shadows. A new result has a restrained 4px entrance over 180ms. The refresh icon rotates only during a request; refreshing an existing result does not replay its entrance. Both added animations exist only when reduced motion is not requested. Controls and status feedback remain immediately usable.

## Shapes

The page reuses shared surface corners (12px) and control corners (8px). Search inputs and main actions have a 48px minimum height; the shared wordmark link has a 44px minimum. The final matrix measured 16px input text and all targets at or above those respective minimums. Thin circular timeline markers and a fine connector support scanning without enlarging each event into a separate card.

## Components

- **Public shell:** Reuses the Order header, footer and isolated public query provider. The shared skip link now says `انتقل إلى المحتوى`. No Admin navigation or staff provider enters tracking.
- **Search:** An explicit label and associated help explain where the number comes from. Enter submits. Validation focuses the input and makes no request for clearly invalid values. A validated identifier-only query link can initiate lookup; repeated query values are rejected rather than silently chosen.
- **Current result:** Mapped Arabic status text and a status icon lead the card. A newly mounted result focuses its heading. Tracking number copying announces success; clipboard failure gives a manual-copy instruction.
- **Public details:** Only contract-approved city names, shipment type, creation time and a non-null, explicitly labelled delivery estimate appear. No last-update timestamp, contact information, office details, payment data or private identity is invented or exposed.
- **History:** A semantic ordered list displays public status and absolute occurrence time in API order. Empty history receives clear text. It neither sorts events nor invents transitions, future stages or internal event details.
- **Refresh:** Deliberate refresh retains keyboard focus through a guarded unavailable state. A failed same-number refresh keeps the last successful result visible with an explanation. Editing another number hides the old result and cancels obsolete work. There is no polling or automatic background refresh.
- **Feedback:** Safe Arabic validation, not-found, rate-limit, service/network and route-boundary states preserve a useful next action. A readable Retry-After drives the visible cooldown; its expiration does not send a request. Loading and copy feedback are announced accessibly.
- **Order handoff:** Confirmation now links to `/track?number=...` using only the authoritative validated number with prefetch disabled. Ordering, quoting, retry and submission behavior remain unchanged.

## Do's and Don'ts

- Do preserve Arabic RTL, visible focus, explicit search, readable inputs and reduced-motion behavior.
- Do keep the current state prominent and every displayed shipment fact inside the approved public schema.
- Do preserve timeline array order and identify an estimated delivery time as an estimate.
- Do distinguish previous successful data from a failed refresh, and let the customer retry deliberately.
- Don't add personal details, internal identifiers, support contacts, office locations or payment claims absent from the approved public contract.
- Don't add a search-history feature, tracking-data persistence, automatic polling, predicted stages or an invented update time.
- Don't promote this surface's width and public control sizing into a replacement for the Admin design system.
- Don't treat local automated checks and screenshot acceptance as physical-device, screen-reader or deployed-service validation.
