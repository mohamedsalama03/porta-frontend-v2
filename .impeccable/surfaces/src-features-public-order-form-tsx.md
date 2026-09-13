---
version: 2
slug: "src-features-public-order-form-tsx"
primary_target: "src/features/public-order/form.tsx"
related_targets: ["src/features/public-order/fields.tsx","src/features/public-order/summary.tsx","src/features/public-order/success.tsx","src/features/public-order/public-order.css","src/features/public-order/query-provider.tsx","src/app/(public)/layout.tsx","src/app/(public)/order/page.tsx","src/app/(public)/order/loading.tsx","src/app/(public)/order/error.tsx"]
---

# Public order booking

Mode: Operate. This brief applies only to `/order` and the public-order feature. The existing Admin Dashboard visual system remains fixed.

Status: Implemented and accepted for ship on 2026-09-13 after an independent finish review returned `ship` with no material visual or UX issues. This is a scoped extension of the approved visual world, not a revision of `PRODUCT.md`, root `DESIGN.md` or the global design sidecar. No deployment claim is made here.

Audience and task: Arabic-speaking customers arranging an intercity shipment on a phone, including in bright everyday settings. Enter contact and shipment details, see the server-provided price, review the request and save the confirmed tracking number.

THESIS: One readable booking form with clear section boundaries and an explicit review before creation. The public page has its own simple header and no admin navigation, giant hero or marketing-card sequence.

OWN-WORLD: Reuse the approved Cairo, warm-neutral surfaces, thin borders and restrained teal actions in light and dark themes. Fixed readable type, 16px inputs, 48px form inputs, radio-label targets and action buttons, with 44px minimum header and validation text actions. Visible keyboard focus; no new logo, imagery or palette.

STORY: Enter sender and recipient, choose route and shipment details, select delivery/payment, add optional notes, review the authoritative total, then submit. The success state presents the returned tracking number and price alongside a clearly identified local snapshot of the submitted details.

FIRST VIEWPORT: A compact text wordmark header, a 28px Arabic heading and one explanatory sentence lead directly into sender fields. The container caps at 1120px. One field column on 390/430px; paired fields from 768px. At 1024px and wider, the form sits beside a 340px sticky price/review panel. On narrow screens the summary follows the fields without covering them.

FORM: Precisely specified single-page sectional flow inside the established visual world; no open composition or identity decision remains. Mobile native selects and radio controls retain platform keyboard/typeahead behavior. Brief-pinned code-led implementation; no concept tournament or raster assets needed.

Memorable interaction: Changing a price-relevant choice removes the usable old quote immediately. A deliberate review precedes creation; confirmation focuses the success heading and copying the tracking number announces success or gives a manual-copy fallback. Native radios retain arrow-key selection and selects retain platform behavior. The only added entrance animation is the success state's 180ms, 4px movement, enabled only when reduced motion is not requested.

Public boundary: The public layout owns an independent query provider and contains no admin navigation or admin imports. Review data, request details, tracking and success data remain in memory. A single non-personal session boolean records previous confirmation so refresh shows a notice without resubmitting or restoring personal details. An uncertain submission keeps its original attempt available for an explicit retry.

Content boundaries: Catalog labels come from public responses; no internal identifiers are shown. Quote exposes a final total, not an invented base/surcharge breakdown. Weight is optional in user-confirmed kilograms. Payment choice does not claim to process a transfer. No support contact was supplied, and public tracking is outside scope, so neither gets an invented link.

FINISH: The final presentation record, `reports/public-order/visual/results.json`, is PASS with 32 captures across six viewport/theme configurations: light at 390, 430, 768, 1024 and 1440px, plus dark at 390px. Captures cover initial, filled, review, error and success states; 390px also covers validation and refresh. The record reports no failures or axe violations. `reports/public-order/design-detector.json` contains no findings. The independent finish review is limited to visual/UX acceptance; these records do not by themselves prove live integration.

Live evidence: Separate public catalog, quote and order acceptance passed with one QA creation, a quote and confirmed price of 1235 millimes, and tracking `PTA-260913-9B906F9B74FA87ED`. The catalog and pricing QA records were restored to inactive; the created QA order was retained. Evidence is in `reports/public-order/live/acceptance.json` and `fixture-restoration.json`.

Unresolved decisions: None for this presentation. Public tracking remains deferred, support contact is omitted because none was supplied, and payment processing is outside this page. Do not insert fake production choices when live catalog or pricing data is unavailable. See `docs/PUBLIC-ORDER-DESIGN.md` for the compact implementation record.
