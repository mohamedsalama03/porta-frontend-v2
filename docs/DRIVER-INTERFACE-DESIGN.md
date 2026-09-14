# Porta Driver interface design

## Overview

Mode: **Operate**. This record describes the implemented Driver Operational Interface, dated 2026-09-14 in Africa/Tripoli. Its audience is an authenticated Arabic-speaking driver reviewing assigned work and deliberately completing the operations allowed by the service.

The explicit Driver phase extends the incumbent [product brief](../PRODUCT.md) and [design system](../DESIGN.md). Their older phase exclusions and admin shell description remain historical context; the current authorization adds `/driver` with dedicated navigation. This document and the [Driver surface brief](../.impeccable/surfaces/src-features-driver-workspace-home-tsx.md) record that extension without rewriting those root files, their sidecar, or earlier public-surface briefs.

The direction is a calm, readable operational workspace: recognize the current state, open assigned work, read its delivery context, and confirm one available operation. Cairo, Arabic RTL, restrained teal, neutral surfaces and thin borders carry the existing identity. This was a precisely specified extension; no new identity, approved composition image, concept round or raster asset was needed. Source and the final rendered evidence are the record of the built design.

The source boundary is [the dedicated route group](../src/app/(driver)/layout.tsx), `src/features/driver-workspace/`, shared authentication/API utilities and the frozen frontend-local [OpenAPI contract](../contracts/porta-api-v1.openapi.json). The backend is an external HTTP service; this surface does not import admin presentation, duplicate backend business rules, or enrich driver data with admin endpoints.

### Evidence and limits

The final [visual results](../reports/driver-interface/visual/results.json) report PASS for 43 measured synthetic states. The matrix covers home, trips, trip detail, shipments, shipment detail, empty, error and inline confirmation at light 390, 430, 768 and 1440px; home and both details at light 1024px; and all eight states at dark 390px. Six extra phone action viewports bring the final image set to 49 PNGs.

The [independent finish review](../reports/driver-interface/visual/FINISH-REVIEW.md) inspected all 49 images and returned `ship` with no material visual or UX fixes. This is the final visual disposition. The earlier [bounded inspection](../reports/driver-interface/visual/REVIEW.md) describes its own ten-image sample, not the extent of the final review. One [mechanical detector pass](../reports/driver-interface/visual/detector.json) returned an empty finding list. The 43 automated states reported zero axe violations, horizontal overflow, undersized visible controls or undersized inputs; they also checked RTL, theme, reduced motion and private storage.

These captures use intercepted synthetic session/read responses, block other API/external requests and writes, and contain no live customer data. Mobile full-page images place fixed navigation at the initial viewport fold; the six deliberately scrolled action viewports separately show the operation, complete confirmation, confirm/return and refresh controls above the navigation. They do not mean the entire document is simultaneously visible on a phone.

Account was reviewed in source only and has no screenshot in this matrix. Loading, pending, keyboard/focus and transient network/concurrency behavior are not proven by still images. Dedicated [browser scenarios](../tests/e2e/driver-workspace.spec.ts) and [action tests](../tests/unit/driver-ui-actions.test.tsx) exercise those interactions separately; the finish reviewer did not operate the browser. This design record makes no final regression-gate, live-acceptance, deployment, physical-device, manual screen-reader or field-performance claim.

## Colors

The Driver workspace consumes the existing custom properties in [globals.css](../src/app/globals.css); it defines no second theme. The main palette remains a quiet neutral green with restrained teal emphasis.

| Role / source token | Light | Dark | Driver use |
| --- | --- | --- | --- |
| `--background` | `#f6f8f7` | `#111a18` | Page ground |
| `--surface` | `#ffffff` | `#182421` | Header, navigation, task and detail cards |
| `--surface-raised` | `#eef2f0` | `#202f2a` | Feedback, quiet hover and skeleton areas |
| `--foreground` | `#192b28` | `#e9f0ed` | Main Arabic text and identifiers |
| `--muted` | `#62716c` | `#a4b4ac` | Context, labels and secondary information |
| `--border` | `#dde5e1` | `#30423a` | Card edges and separators |
| `--accent` | `#16735d` | `#81d5b5` | Actions, current navigation and status emphasis |
| `--accent-soft` | `#e8f3ee` | `#243f34` | Selected navigation and status background |

Hover uses `--accent-hover`. Authoritative action success and the delivered detail state use the incumbent success tokens; stale-scope notices use warning tokens. Status always has an Arabic label and never depends on color alone. The source CSS remains normative if global values evolve.

## Typography

All text inherits Cairo through `--font-cairo`, with the existing sans-serif fallback and 1.75 body line height. There is no display-font treatment. Headings, identifiers and route information establish hierarchy through a small weight and size range.

| Role | Observed treatment |
| --- | --- |
| Page title | 26px in operational pages; 25px in account/access panels |
| Section and confirmation heading | 20px; trip shipment heading 21px; detail heading 22px |
| Route and tracking identity | 18px; tracking number 700 weight |
| Body and buttons | Generally 14px, with readable inherited Arabic line spacing |
| Metadata and status | 12–14px; subdued labels, 13px status text at 600 weight |
| Filter select | 16px with a persistent 14px label |

Tracking numbers and telephone values are isolated LTR within RTL text. Email is bidirectionally isolated. Identifiers, names and addresses wrap within their containers; addresses preserve meaningful line breaks. Driver-facing times use the shared absolute-instant formatter in **Africa/Tripoli**, presented as Libya time, with no manual UTC offset or invented estimate.

## Layout

The dedicated shell contains a compact 72px-minimum header, the Porta wordmark/icon and a small Arabic workspace label. Its four navigation destinations are **الرئيسية**, **الرحلات**, **الشحنات**, and **الحساب**. The current destination uses `aria-current="page"` and the teal selection treatment, including on nested detail routes. Header, navigation and main content share a maximum width of 1040px.

Below 768px the navigation is fixed at the bottom with four equal-width destinations and 58px-minimum link heights. The shell reserves `92px + env(safe-area-inset-bottom)` beneath content; navigation also includes the safe-area inset. Main content uses 20px horizontal padding and 24px top padding. Task cards and contact blocks form one column. Compact definition-list metadata remains two wrapping columns inside a detail card, including on phones.

At 768px and above navigation becomes a static top row with 48px-minimum links, main padding becomes 32px, and task/contact collections use two columns. Confirmation controls share a row at these widths and stack on phones. Detail cards remain within the same bounded content area. Account content caps at 680px. There is no driver sidebar, dense table, command palette, chart or dashboard metric grid.

Spacing follows the incumbent 4px rhythm: 16px task-card gaps, 20px card padding, 24px detail grouping and 36px between home sections. Details use 24px by 20px padding on phones and 28px at the wider breakpoint. These dimensions are documented in [workspace CSS](../src/features/driver-workspace/driver-workspace.css) and [shell CSS](../src/features/driver-workspace/shell.css).

## Elevation & Depth

Driver cards, the header and navigation are flat surfaces distinguished by tone, a one-pixel border and spacing. They introduce no card shadow or glass effect. The fixed phone navigation establishes position through a border and reserved page space. Inline confirmation stays in document flow, so the operation does not open an unnecessary modal layer.

## Shapes

Task/detail cards, feedback and confirmation use the global 12px surface radius. Buttons and selects use the existing 8px control radius. Navigation links use 10px corners; access/account panels use 14px corners. Small Lucide line icons support navigation, route direction, calling and refresh without replacing text labels. No illustrations, decorative material, gradient heading, background image or new logo mark is introduced.

## Components

### Home and task cards

Home presents **من رحلاتك** followed by **من شحناتك**, with direct links to their full lists and separate refresh controls. It reads the first server page at `per_page: 20` and displays up to three items from each response in the supplied order. It does not claim these are the next trip, current active trip, complete workload or completed-today total. Missing aggregate capabilities do not become invented KPIs.

Trip cards lead with status, an optional contract-supplied shipment count, origin/destination and departure, then a 48px-minimum open action. Shipment cards lead with status/delivery method, tracking number, recipient name and available destination, then their open action. Lists use a single labelled status filter and server cursor pagination; they do not fetch the entire workload. Non-sensitive filter/cursor state may be in the URL. Invalid filter input receives a safe reset route.

### Details and contact

Trip detail presents status, route, departure, optional estimated arrival/count and a paginated driver-scoped shipment list. It explicitly states that the operations team manages trip actions; no unsupported start/arrival/completion control is invented.

Shipment detail presents status and tracking identity before available city, delivery method, size/type, textual delivery address and contacts. Recipient and sender names/phones are rendered because those fields are explicitly included in the approved DriverShipment resource. This is not permission to reuse a broader admin resource or add unrelated contact information. A plain validated phone number enables **اتصال** through `tel:`; invalid dialing text remains non-actionable. There is no contact logging, persistent contact storage, map SDK, GPS request or location tracking. A supplied trip identifier links back to its scoped trip.

Strict generated response schemas and resource/filter checks keep the presentation inside its contract. Internal audit, staff notes, ledgers, pricing, admin account/security fields and unrelated business data are not part of the driver presentation. The account route separately shows only the current authenticated name/email and secure logout; it offers no profile editing or invented availability context.

### Operational confirmation

Only the two edges documented by the approved driver shipment-status operation are offered: `ARRIVED_CITY → READY_FOR_PICKUP` and `READY_FOR_PICKUP → DELIVERED`, subject to its backend permission. This narrow display mapping does not establish a general frontend lifecycle authority. Backend validation remains decisive.

One full-width primary action opens a deliberate inline confirmation containing the current status, requested operation and explicit Arabic real-world condition. Confirm and return are distinct 48px-minimum controls. Opening confirmation focuses its heading; cancellation returns focus to the initiating button. Pending blocks duplicate submission and names the operation in progress. Success appears only after a valid authoritative response, with a status announcement and focused result heading.

An uncertain retry retains the same logical action/key/body. A new deliberate operation receives a new identity. A 409 shows **تم تحديث البيانات. يرجى مراجعة الحالة الحالية.** and refreshes the authoritative resource for review. A 422 gives safe domain feedback and requires a fresh confirmation; 429 respects the readable Retry-After countdown. There is no optimistic success, silent overwrite, automatic mutation retry or offline write queue.

### Reads, empty states and access

Initial reads use labelled card skeletons. Refresh is deliberate; the current data remains visible during a refresh and after transient failure with an explicit stale-data explanation. Driver queries live in a separate memory cache with a 30-second freshness window and five-minute inactive retention. Automatic retries, focus/reconnect refresh and polling are disabled; memory caching is not offline synchronization.

Denied resources are removed rather than preserved as stale private data. Shared cookie-session authentication, the driver identity check and a successful driver-scoped read precede protected content. Backend permissions govern mutation availability. Session expiry hands off to the shared safe login flow, and session end clears private cached work. Safe unavailable and retry states cover identity/scope failures without exposing raw backend details.

Empty lists state the absence of assigned work and keep useful refresh/navigation. Service/network errors use short Arabic guidance and a subordinate request reference where available. A rate-limit countdown never triggers a request by itself.

### Accessibility and motion

The shell provides semantic header/navigation/main landmarks, a skip link, labelled navigation and visible global teal focus rings. Primary operational controls are at least 48px high; secondary links are at least 44px where used. Loading, pending and success use status announcements; failures use safe alert text. The inline confirmation uses normal document navigation and explicit focus movement rather than a dialog focus trap.

Navigation hover transitions reuse the 150ms incumbent duration; the workspace adds no prominent motion. Reduced-motion CSS removes shell/session transitions and animations, while the shared stylesheet handles the common skeleton treatment. The capture matrix runs with reduced motion enabled. Automated checks and source inspection support this record within their stated limits; they do not establish complete accessibility conformance.

## Do's and Don'ts

- **Do** preserve Arabic RTL, Cairo, clear status labels, isolated identifiers and the incumbent light/dark tokens.
- **Do** keep next-step actions obvious, 48px primary controls deliberate, and phone action areas clear of fixed navigation.
- **Do** use driver-scoped contract fields and backend-confirmed state, with manual refresh and honest stale-data feedback.
- **Do** maintain source and evidence boundaries when extending this record; visually review account or new transient states before claiming their capture coverage.
- **Don't** import admin chrome, tables, reports, pricing editors or public ordering/tracking presentation into this workspace.
- **Don't** invent totals, lifecycle transitions, trip actions, sorting promises, driver availability or private-field permissions.
- **Don't** add GPS, live maps/streams, scanner, proof of delivery, persistent customer caches, PWA behavior or offline mutation queues as implied extensions.
- **Don't** describe synthetic browser evidence as live acceptance, physical-device validation, a field SLA or deployment approval. Integration gaps belong in [API-INTEGRATION-GAPS.md](API-INTEGRATION-GAPS.md), and final engineering acceptance is reported separately.
