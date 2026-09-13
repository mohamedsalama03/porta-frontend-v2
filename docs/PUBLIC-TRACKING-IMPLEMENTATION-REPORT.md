# PORTA DELIVERY

# PUBLIC TRACKING IMPLEMENTATION REPORT

Acceptance completed 14 September 2026 (Africa/Tripoli). This phase adds the anonymous public shipment tracking experience to the approved Public Order frontend.

## Baseline

| Item                                          | Verified value                                                     |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Independent frontend repository               | `D:\customers\porta frontend`                                      |
| Starting branch / worktree                    | `main`, clean                                                      |
| Starting frontend SHA                         | `46080fa147a7a94008bcfbc8422bf5347f3b5bef`                         |
| Backend integration revision supplied by user | `064f2903b7f612ff486428d00039387538a040e9`                         |
| Approved API origin                           | `http://localhost:8080`, existing `NEXT_PUBLIC_API_BASE_URL`       |
| OpenAPI file                                  | `contracts/porta-api-v1.openapi.json`                              |
| OpenAPI SHA-256                               | `2b025d1d9c33407920869eea6a0cf5bf5cc6971643b28e6e0c36f54a682ae658` |
| Feature branch                                | `feat/public-tracking`                                             |

The Public Order baseline was confirmed on `main` before creating the feature branch. The backend revision is user-provided context; no backend repository was searched, read or modified. OpenAPI and generated artifacts remain unchanged; contract drift check passed. No dependencies were added.

## Tracking Operation

Only `getTrackingTrackingNumber`: **GET `/api/v1/tracking/{trackingNumber}`**, with contract `security: []`.

The path identifier follows the approved pattern `^PTA-[0-9]{6}-[A-Z0-9]{6,20}$`. The API documents malformed and unknown identifiers as 404. The form trims outer whitespace, preserves case/characters, and uses the generated path schema for validation. Clearly invalid input receives inline Arabic guidance without an HTTP request.

The existing centralized API client sends the configured origin, `cache: no-store`, cancellation signal and `notifyOnUnauthorized: false`. No tracking request requires staff discovery, CSRF bootstrap, authorization header, audit, payment ledger or private shipment lookup. Strict generated response validation precedes rendering; valid-but-mismatched response tracking identifiers are rejected. Loose envelope metadata and request ID are discarded before successful query data enters memory.

## Public Routes Added

- `/track`: server-rendered public shell and narrow client interaction inside Suspense.
- `/track?number=<encoded-tracking-number>`: automatic validated lookup and shareable identifier-only URL.
- Route loading and error boundaries; no additional dynamic pathname route.

The shell is prerendered, while customer results are fetched only in the browser. No customer result is statically generated or placed in a public Next.js data cache. Arabic metadata title is `تتبع الشحنة | Porta Delivery`, with no identifier in metadata. Tracking uses `noindex, nofollow, noarchive` and a `no-referrer` metadata policy, alongside existing global security headers.

## Data Displayed

- Tracking number and current status.
- Origin and destination Arabic city names and shipment type.
- Creation time and an explicitly labelled estimated delivery time when non-null.
- Public timeline status and occurrence timestamp.
- Manual refresh and tracking-number copy controls.

There is no `updated_at` field, so the page does not invent a last-update timestamp. Delivery method, shipment size, office address, payment data and proof of delivery are absent from the approved public tracking schema and are omitted. Contract-provided `status_label` is validated but the centralized Arabic enum mapping supplies consistent display text.

## Explicitly Hidden / Unused Private Data

Sender/recipient full names, phones, address, internal UUIDs/ULIDs/database IDs, staff or driver identity/contact data, internal notes, audit details, payment ledger and authorization details are not displayed. No enrichment endpoint is called. Unexpected properties in the response data, city objects or timeline entries cause strict validation to fail. Components also explicitly select permitted fields, with a regression test proving that unexpected fixture properties are not rendered.

## Status Mapping

| Backend enum       | Arabic display  |
| ------------------ | --------------- |
| `RECEIVED`         | تم استلام الطلب |
| `PREPARING`        | جاري التجهيز    |
| `IN_TRANSIT`       | خرجت في رحلة    |
| `ARRIVED_CITY`     | وصلت للمدينة    |
| `READY_FOR_PICKUP` | جاهزة للاستلام  |
| `DELIVERED`        | تم التسليم      |

Mapping is centralized in `src/features/public-tracking/status.ts`. It is display-only: no transition rules, predicted extra stages, final-delivery status or lifecycle discovery. Delivered is distinguished by a completion icon and text as well as color. Pickup copy adds no invented office address.

## Timeline

An RTL vertical ordered list displays the public events in **exact API array order**. The contract gives no ordering guarantee, so the frontend does not sort or infer lifecycle order. Every event renders a mapped status and absolute occurrence time. Empty history receives a clear empty state. No notes, actor identity, audit metadata or unsupported event fields are shown.

## Timezone Handling

All displayed instants use the existing `formatDate` helper with hour/minute options. Its timezone is `Africa/Tripoli`; no manual UTC offset is added. Semantic `<time dateTime>` preserves the absolute source instant. Tests include offset-bearing timestamps and a nonchronological API timeline to distinguish formatting from ordering.

## Deep Link

`trackingHref` generates an encoded URL containing only a validated tracking number. One query value is accepted; repeated `number` parameters are not silently chosen. Invalid URL values remain visible for correction and do not trigger lookup. Successful/requested valid searches replace the current URL without adding a stored search-history feature. No automatic lookup occurs while typing.

TanStack Query uses identifier-specific keys, a 30-second stale time and five-minute in-memory garbage collection. URL hydration/StrictMode is deduplicated before HTTP. Editing to another identifier cancels obsolete work and hides the previous identifier's result; tested A→B→A races cannot overwrite the current request. Automatic retries, focus/reconnect/mount refetch, polling and background refresh are disabled. Manual refresh is controlled and preserves a previous successful same-number result if its refresh fails.

## Order Form Handoff

The existing order success component adds a real `تتبع الشحنة` link using only the authoritative returned tracking number, with prefetch disabled. Order submission, quote, catalog, idempotency, retry and confirmation logic are unchanged. Browser coverage completes a synthetic order, follows its tracking link, and confirms creation is not repeated.

The existing public layout and its isolated query provider are reused. The only shared layout text change generalizes the skip link to `انتقل إلى المحتوى`; the corresponding existing browser assertion was updated.

## Error Handling

| Condition                      | Customer behavior                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Empty / contract-invalid input | Associated Arabic guidance; input receives focus; no HTTP call                                                              |
| 404                            | `لم نعثر على شحنة بهذا الرقم`, with correction guidance                                                                     |
| 429                            | `يرجى الانتظار قبل المحاولة مرة أخرى`; readable Retry-After establishes an absolute cooldown across identifiers and actions |
| 500 / 503                      | Safe temporary-service message and validated request reference where available                                              |
| Network failure                | Preserved input, explicit retry; last successful same-number result remains labelled as previous data                       |
| Invalid response               | Safe service error; no arbitrary response rendering                                                                         |
| Clipboard denied               | Manual selection/copy fallback and accessible feedback                                                                      |

The cooldown never issues a request when its timer expires; retry remains deliberate. No delay is invented if Retry-After is absent or unreadable, and there are still no automatic retries. Backend prose, validation details, stack traces and authorization information are never displayed. There is no misleading staff sign-in prompt in the public flow.

Two defects found during acceptance were fixed: an edited rate-limited identifier's retry control now submits the visible input, and refreshing uses a guarded `aria-disabled` control to preserve keyboard focus. Regression tests cover both. `tracking-e2e.initial.log` is the superseded focused run (12 passed, one refresh-focus failure); `test-e2e.log` is the final passing full run (42 passed).

## Privacy

Tracking numbers and results remain in the URL and memory only. No tracked-number local/session storage, suggestions, recent-search history, analytics or customer-data logging was added. Existing theme/density preferences remain separate. Public response schemas reject private field additions; allowed successful envelope metadata is discarded. Live checks record enum/count/field names and booleans rather than response bodies or cookie values.

The tracking flow works in a fresh anonymous browser context and imports no staff auth provider, permissions, Admin shell or operational modules. The inherited full live regression suite separately exercises existing authentication/cookie behavior; those are not requests from the tracking experience.

## Mobile / Responsive

Final visual matrix: **40 captures, PASS**, covering 390, 430, 768, 1024 and 1440px light mode, plus 390px dark mode. Every configuration covers empty, loading, success, delivered, not-found and service error; four additional mobile fixtures cover the intermediate enum states. No real shipment was changed to produce visual states.

All measured configurations had zero horizontal overflow, 16px inputs, and controls at least 44px high (main form/actions 48px). Long identifiers, Arabic city/type labels and timestamps wrap. Evidence: `reports/public-tracking/visual/results.json` and its listed screenshots.

## Accessibility

All 40 visual states had **zero axe violations**; Lighthouse accessibility was 100 in all four lab runs. Explicit labels, Enter submission, associated validation/error feedback, semantic timeline list, status text/icons, loading announcements, and copy feedback are present. New-result heading receives focus; refresh retains its button focus. Reduced motion disables the result entrance and refresh animation; refreshing does not replay the timeline entrance.

Physical-device and manual screen-reader testing were not performed. Automated accessibility results are not a claim that every assistive-technology combination has been validated.

The independent Impeccable finish reviewer returned **ship** after inspecting all 40 final screenshots and the related source, with no material visual/UX fixes required. The review did not independently operate the browser or make HTTP calls. The mechanical design detector ran once and returned no findings. Both initial inspection and the final confirmation matrix passed; no further polish or recapture was required.

## Performance

Lighthouse ran against a verified production `next start` build, not the development server. The loaded result uses an intercepted synthetic delivered response. Build ID: `ndeBqn8NE1A1o4JSagQCQ`.

| Lab case       | Performance | Accessibility | Best Practices |     LCP |     CLS |    TBT |  JS transfer |
| -------------- | ----------: | ------------: | -------------: | ------: | ------: | -----: | -----------: |
| Mobile empty   |          92 |           100 |            100 | 3233 ms | 0.00250 | 136 ms | 335810 bytes |
| Mobile loaded  |          86 |           100 |            100 | 3841 ms | 0.02134 | 185 ms | 335810 bytes |
| Desktop empty  |         100 |           100 |            100 |  669 ms | 0.00829 |   0 ms | 335810 bytes |
| Desktop loaded |         100 |           100 |            100 |  814 ms | 0.01883 |   0 ms | 335810 bytes |

Mobile loaded performance is lower than the empty state and is reported without a production-speed claim. This is local lab navigation evidence; it excludes real backend latency, field INP and physical-device performance. No acceptance threshold was invented. Full metrics and resource lists: `reports/public-tracking/performance/results.json`. The temporary production measurement server was stopped afterward.

## Bundle Isolation

Built route-entry chunks, excluding common framework runtime:

| Route                    | Decoded entry bytes | Gzip entry bytes |
| ------------------------ | ------------------: | ---------------: |
| Public Tracking          |              560237 |           143607 |
| Public Order             |              614985 |           160550 |
| Admin Dashboard          |              732097 |           194986 |
| Admin operational module |              843703 |           224057 |

Tracking has nine entry chunks and is smaller than both Admin comparisons. Its client source references contain no Admin auth/session provider, tables, charts, permissions or operational editor modules. Built tracking chunks contain no tested TanStack Table signatures. Shared framework, motion provider, public query provider and schema/client utilities remain. This is a bundle comparison, not measured authenticated Admin load time. Evidence: `reports/public-tracking/performance/bundle-isolation.json`.

## Live Tracking Acceptance

**PASS** using the existing synthetic QA order `PTA-260913-9B906F9B74FA87ED`.

- Initial public lookup: HTTP 200, strict contract valid, status `RECEIVED`, one timeline event.
- Manual refresh: HTTP 200, strict contract valid.
- Exactly two GET requests to the public tracking path; no authorization header, staff calls, blocked requests or mutations in this flow.
- Fresh anonymous context; no stored tracking identifier.
- DOM checks passed for absence of private field labels, private phone values and internal identifiers.
- No new order was created and no shipment status was advanced.

Evidence: `reports/public-tracking/live/acceptance.json`. Other visual status states and 404/429/service errors were tested with intercepted fixtures. No live rate-limit pressure test was performed.

## Testing

- Focused tracking: **31 unit tests** across API, model, query and UI test files.
- Full unit gate: **203 passed in 31 files**.
- Full Playwright gate: **42 passed**: 16 existing Admin/foundation, 13 Public Order and 13 Public Tracking.
- Full live Playwright gate: **5 passed**, including the existing four live checks plus read-only tracking acceptance.
- Public response validation, unexpected private fields, identifier mismatch, status mapping, authoritative timeline order, timezone, URL parsing, StrictMode, cancellation/races, refresh, 404, 429, network/503, clipboard fallback and order handoff are covered.

## Existing Public Order Regression

All **30 existing Public Order unit tests** and **13 Public Order browser tests** remained green in the full gates. Real catalog availability rendering also passed the inherited live test. The tracking handoff was tested with synthetic order creation only. No real order submission was repeated during this phase; the previously retained QA order was used for read-only acceptance.

## Existing Admin Regression

All existing unit coverage and **16 Admin/foundation browser cases** passed. The inherited live authentication/CSRF/session-boundary checks passed. No Admin application source, permissions, editor, reports, payments, drivers, trips or shipment lifecycle code changed. An interactive authenticated operational-write retest was not performed or needed for this isolated public read-only phase.

## Quality Gates

| Command             | Result                     |
| ------------------- | -------------------------- |
| `npm run api:check` | PASS, no contract drift    |
| `npm run lint`      | PASS                       |
| `npm run typecheck` | PASS                       |
| `npm run test`      | PASS, 203 tests            |
| `npm run test:e2e`  | PASS, 42 tests             |
| `npm run test:live` | PASS, 5 tests              |
| `npm run build`     | PASS, 10 prerendered pages |

Gate logs and machine-readable summary: `reports/public-tracking/gates/`. Unit execution used the existing process-local single-worker setting; assertions were not weakened.

## Source Changes

New application files:

- `src/app/(public)/track/page.tsx`, `loading.tsx`, `error.tsx`.
- `src/features/public-tracking/api.ts`, `model.ts`, `status.ts`, `use-tracking.ts`, `tracking-form.tsx`, `result.tsx`, `timeline.tsx`, `skeleton.tsx`, `public-tracking.css`.

Existing application files changed:

- `src/features/public-order/success.tsx`: add the encoded, prefetch-disabled tracking link only.
- `src/app/(public)/layout.tsx`: generic public skip-link wording only.

Test and verification files:

- Four `tests/unit/public-tracking-*` test files.
- `tests/e2e/public-tracking.spec.ts` and `tests/live/public-tracking.spec.ts`.
- `tests/e2e/public-order.spec.ts`: one skip-link label assertion.
- `playwright.config.ts`: isolated tracking project sharing the connected public test server; existing foundation isolation preserved.
- `scripts/public-tracking-check-fixtures.mjs`, `check-public-tracking.mjs`, `check-public-tracking-performance.mjs`, `check-public-tracking-bundle.mjs`.
- `.gitignore`: raw Lighthouse output exclusions only; concise performance evidence remains tracked.
- `docs/PUBLIC-TRACKING-DESIGN.md`, `.impeccable/surfaces/src-features-public-tracking-tracking-form-tsx.md`, this report and `reports/public-tracking/` evidence.

No OpenAPI, generated schema, dependency/lockfile, Admin application or backend changes. No environment-domain hardcoding was added to application code. Root `DESIGN.md` and `PRODUCT.md` remain unchanged.

## Commits and Source Freeze

| Commit                                                          | Scope                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `f9d9667`                                                       | Validated public lookup, controlled query state and focused API/model/query tests                |
| `1a8118b`                                                       | Arabic public route, safe status/timeline presentation, order handoff and UI tests               |
| `0d9e2a1`                                                       | Browser/live regression, privacy, visual/performance tooling and acceptance evidence             |
| `docs(tracking): record implementation and acceptance evidence` | This report and scoped design documentation; full final hash is in the source-state record below |

The [final source-state record](C:/Users/Mohamed/.codex/visualizations/2026/09/13/01a09a82-f5a8-79a1-aa24-83ca1f166784/porta-public-tracking-final-source-state.json) is written after documentation is committed and records full HEAD, branch, clean status, the latest decorated log (up to ten entries), all changed files, unchanged main and OpenAPI SHA. It lives outside the repository so recording the final commit does not create an additional uncommitted change or a self-referential commit hash. `main` remains at the approved starting SHA. No merge, push, history rewrite, tag or deployment is part of this phase.

## Remaining Gaps

| Classification       | Result / limitation                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FRONTEND GAP         | No confirmed supported-flow defect remains after the focused fixes and passing regression gates.                                                                                                 |
| BACKEND CONTRACT GAP | None blocking. Public fields absent from the contract are intentionally omitted.                                                                                                                 |
| TEST DATA GAP        | None blocking; the retained synthetic QA shipment was valid. Other status states use deterministic fixtures.                                                                                     |
| ENVIRONMENT GAP      | Live 429 was not forced; physical-device/manual screen-reader checks and production field performance were not measured. Local Docker/localhost evidence does not establish deployment behavior. |
| DEFERRED FEATURE     | Driver mobile, GPS/maps, polling/live location/WebSockets, lifecycle discovery, payment processing and deployment remain outside this phase.                                                     |

## Final Result

**PUBLIC TRACKING IMPLEMENTATION PASSED WITH DOCUMENTED GAPS**

The core public tracking flow, privacy boundary, real QA lookup/refresh, order handoff, responsive presentation and all seven regression gates passed. The documented gaps are bounded environmental/test limitations and deferred capabilities, not a broken supported tracking flow.
