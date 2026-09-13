# Public order design record

## Overview

`/order` is an Arabic RTL booking form for customers arranging intercity shipments. Its sectional form, authoritative price, explicit review and focused confirmation extend the approved Porta visual language. This record is scoped to `src/features/public-order/` and `src/app/(public)/`; the Admin Dashboard world in [DESIGN.md](../DESIGN.md), [PRODUCT.md](../PRODUCT.md) and the global design sidecar remains unchanged.

Recorded on 2026-09-13 after the independent finish review returned `ship` with no material visual or UX issues. That disposition concerns the assembled public surface and does not imply deployment.

The final [presentation record](../reports/public-order/visual/results.json) is PASS: 32 captures across light at 390, 430, 768, 1024 and 1440px, plus dark at 390px. Initial, filled, review, error and success states are covered in each configuration; validation and refresh are additionally captured at 390px. The record reports no failures or axe violations, and the [design detector](../reports/public-order/design-detector.json) reports no findings. These checks use synthetic public responses and establish presentation coverage, not live acceptance or exhaustive accessibility conformance.

Separate [live acceptance](../reports/public-order/live/acceptance.json) passed through public catalogs, quote and one QA order creation. Quote and confirmation both returned 1235 millimes; the retained QA order tracking number is `PTA-260913-9B906F9B74FA87ED`. Refresh did not resubmit and no staff requests were observed. The temporary catalog and pricing records were [restored to inactive](../reports/public-order/live/fixture-restoration.json).

## Colors

The surface inherits the established light/dark tokens from `src/app/globals.css`: warm neutral backgrounds, thin muted borders, restrained teal for primary actions and selection, and semantic error/success colors. Public ordering introduces no palette, imagery or logo asset. The header uses the Porta Delivery text wordmark.

## Typography

Cairo remains the shared Arabic typeface. The public page uses readable body text (15px), a compact page heading (28px), section headings (18px), field labels (14px) and native input text (16px). Phone numbers and tracking identifiers preserve their left-to-right reading order within the RTL page. Long customer text and tracking identifiers wrap within their containers.

## Layout

The content width caps at 1120px, with 16px side margins on phones and 32px from the 768px breakpoint. One field column serves narrow screens. Related fields and radio choices become paired columns from 768px. From 1024px, the form occupies the flexible column beside a 340px summary, sticky 24px from the top. On smaller screens the summary follows the form in document order and does not cover fields.

Sections use headings, generous internal spacing and thin dividers. The header and short introduction lead directly into the task. Confirmation is a centered surface capped at 720px, with the tracking number and server-confirmed total before the submitted-detail snapshot.

## Elevation & Depth

Form, summary and confirmation use borders and surface tones for separation. They add no shadow treatment. State changes remain immediate; the only added entrance animation moves confirmation by 4px over 180ms and runs only when reduced motion is not requested.

## Shapes

The public surface reuses the shared surface radius (12px) and control radius (8px). Inputs, radio-label targets and action buttons have a minimum height of 48px. The header link and validation text actions have a 44px minimum. Native radio glyphs sit within the larger clickable labels.

## Components

- **Public shell:** A skip link, simple header, main region and quiet footer. Its independent query provider owns a public cache; no admin shell or admin imports enter the public route.
- **Fields:** Persistent labels, associated hints and errors, native selects and grouped native radios preserve keyboard and platform behavior. Optional weight is explicitly in kilograms. Door delivery reveals its required address field. Notes remain optional.
- **Quote and review:** The server supplies the final total; no base-price or surcharge breakdown is fabricated. Changing a price-relevant choice immediately makes the old quote unusable. Review focuses the summary, displays customer-facing catalog labels and locks the form until the user edits or confirms.
- **Feedback:** Catalog loading, empty and unavailable states explain why booking cannot continue. Validation identifies fields for correction. Safe request errors and retry timing appear in context. An uncertain order result retains the original attempt for an explicit retry with the same details.
- **Confirmation:** The returned tracking number and price are authoritative. The heading receives focus. Copying announces success; a failed copy provides a manual-copy instruction. The detail section is labelled as the information the customer submitted, since it is a local snapshot.
- **Refresh:** Review, personal details, tracking and success data stay in memory. Only a non-personal session boolean records previous confirmation. Refresh shows a notice without restoring those details or submitting another order; starting another shipment requires an explicit action.

## Do's and Don'ts

- Do preserve Arabic RTL, visible focus, native control behavior, readable phone inputs and reduced-motion support.
- Do keep catalogs and price authoritative and show a useful unavailable state when approved live data is absent.
- Do keep this surface's roomier controls and sectional composition scoped to public ordering.
- Don't add an invented support link: no support contact was supplied.
- Don't imply public tracking is available. Tracking lookup remains deferred; confirmation only presents the returned number for the customer to save.
- Don't imply payment is processed. The page records the selected payment method and explicitly states that no payment operation happens here.
