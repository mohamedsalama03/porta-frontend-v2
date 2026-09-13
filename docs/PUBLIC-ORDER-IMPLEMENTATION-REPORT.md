# PORTA DELIVERY

# PUBLIC ORDER FORM IMPLEMENTATION REPORT

Date: 13 September 2026. Scope: the independent Next.js frontend at `D:\customers\porta frontend`.

## Baseline

| Item                           | Verified value                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Starting frontend              | `4e412c5c4717f56af12e053edbbc5d476bc3f5e7`                                                         |
| Starting Git state             | `main`, clean worktree                                                                             |
| Backend integration revision   | `064f2903b7f612ff486428d00039387538a040e9`, supplied by the user; backend repository not inspected |
| Feature branch                 | `feat/public-order-form`                                                                           |
| API origin                     | Existing environment configuration: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`               |
| Public route                   | `http://localhost:3000/order`                                                                      |
| Approved contract              | `contracts/porta-api-v1.openapi.json`                                                              |
| OpenAPI SHA-256                | `2b025d1d9c33407920869eea6a0cf5bf5cc6971643b28e6e0c36f54a682ae658`                                 |
| Contract drift                 | PASS: generated schemas match the approved contract                                                |
| Generated API artifact changes | None. No regeneration or manual schema edits were needed                                           |

The frozen baseline and existing Admin application code were preserved. No backend repository, source, database, migration or filesystem was accessed.

## OpenAPI Operations Used

| Purpose                      | Operation          | Exact HTTP path              |
| ---------------------------- | ------------------ | ---------------------------- |
| Active public cities         | `getCities`        | `GET /api/v1/cities`         |
| Active public shipment types | `getShipmentTypes` | `GET /api/v1/shipment-types` |
| Authoritative quote          | `postQuotes`       | `POST /api/v1/quotes`        |
| Create public order          | `postOrders`       | `POST /api/v1/orders`        |

These operations declare public security. Stateful browser writes use the existing centralized cookie/CSRF client, including `/sanctum/csrf-cookie` when needed and `X-XSRF-TOKEN`. Order creation requires `Idempotency-Key`. Public requests suppress staff-session expiry notifications and never request staff identity or admin resources.

All request/response validation uses the generated contract. Components contain no arbitrary fetch calls, invented endpoint, price calculation or response shape.

## Public Routes Added

`/order` has a dedicated public layout, server-rendered heading/header/footer, independent query provider, loading state and error boundary. Arabic metadata uses `طلب شحن | Porta Delivery`; indexing remains disabled until a public indexing strategy is approved.

Confirmation is a state within `/order`. No `/order/success` or tracking URL was invented, and no dashboard route moved.

## UX Architecture

One Arabic RTL page groups sender, recipient, route, shipment, delivery/payment, optional notes and review. Native selects support platform keyboard/typeahead behavior. Cairo and existing semantic colors are reused with roomier public controls. The page has no admin sidebar, dense tables, staff controls or marketing claims.

Customers review the entered information and authoritative total before a separate final confirmation action. The summary sits alongside the form at desktop widths and follows it on smaller screens. Support contact is omitted as requested.

## Fields Implemented

| Contract field                          | Behavior                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `sender_name`, `recipient_name`         | Required; Arabic/diacritics supported; maximum 150 characters                                             |
| `sender_phone`, `recipient_phone`       | Required; telephone keyboard, LTR presentation and safe autocomplete; maximum 40 characters               |
| `origin_city_id`, `destination_city_id` | Options exclusively from the public cities response                                                       |
| `shipment_type_id`                      | Public Arabic label and description when supplied                                                         |
| `shipment_size`                         | `SMALL`, `MEDIUM`, `LARGE`, with Arabic labels                                                            |
| `weight`                                | Optional; positive, maximum 100000, up to three decimal places; kilograms explicitly approved by the user |
| `delivery_method`                       | `OFFICE_PICKUP` or `DOOR_DELIVERY`                                                                        |
| `delivery_address`                      | Required only for door delivery; maximum 500 characters; omitted for office pickup                        |
| `payment_method`                        | `CASH_ON_DELIVERY` or `PREPAID_TRANSFER`; records a choice without processing payment                     |
| `notes`                                 | Optional; maximum 2000 characters with counter                                                            |

Phone input is not silently assigned a country code or restricted by an invented regex; the generated Phone schema and backend remain authoritative. The frontend does not introduce an undocumented same-city restriction. Branch, price, status, payment state and staff fields cannot be added through the public form.

## Quote Integration

Quote requests contain exactly origin, destination, type, size and delivery method. Catalogs use TanStack Query with a five-minute stale time. Quote requests debounce for 350 ms and cancel obsolete requests.

Any price-relevant change immediately removes the usable old total. A response for an obsolete selection cannot restore it, including an A → B → A race. Review and final submission validate the current selection fingerprint. Empty catalogs or unavailable pricing cannot create an order.

Only the returned final total is displayed using the shared integer-millime LYD formatter. Zero is accepted when explicitly returned as a valid quote. No surcharge breakdown, quote token, price reservation or fallback amount is fabricated.

## Idempotency

One secure UUID key belongs to one captured, immutable order body. Synchronous duplicate-click protection and the shared idempotent action prevent concurrent duplicate creation. Successful actions remain settled.

Network, server and ambiguous conflict failures keep the form locked to the original attempt; deliberate retries reuse its body and key. There is no automatic order retry or order AbortSignal. A definitive 422 rejection returns editable fields and permits a new corrected logical attempt.

Retry-After deadlines are respected for orders, both catalog requests, and quotes. Quote deadlines survive selection changes and temporary disabling; an independent reproduction verified the next request at 10002 ms after a required 10000 ms delay.

## Error Handling

| Failure                                | Customer behavior                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 422                                    | Safe field mapping, preserved values, error summary and first-invalid-field focus                        |
| 409                                    | Neutral conflict wording, no claim that another user edited data, original attempt retained              |
| 429                                    | Readable exposed Retry-After countdown and guarded retries                                               |
| 500 / 503                              | Safe Arabic explanation, preserved attempt and deliberate retry                                          |
| Network                                | Connection guidance with preserved input and original attempt                                            |
| Invalid response / other service error | Safe feedback and request reference when available; no raw JSON, stack trace or unreviewed backend prose |

## Success Experience

The returned tracking number and final price are authoritative. A separately labelled local snapshot presents the submitted route, type, size, optional weight, delivery method/address, payment choice and notes. No internal shipment UUID is shown.

Confirmation focuses its heading. Copy tracking announces success or a manual-copy fallback. There is no unavailable tracking link or fake payment processing.

Personal details, notes, tracking and request bodies remain in memory. Only a non-personal session boolean records previous confirmation. Refresh shows a safe previous-order notice and never resubmits; another shipment requires an explicit new-order action. No customer data is stored in URL parameters, localStorage, console logs or analytics.

## Mobile / Responsive

Verified 390, 430, 768, 1024 and 1440 px, plus dark mode at 390 px. Thirty-two captured states cover initial, filled, review, conflict and success at each configuration, plus mobile validation and refresh. Long Arabic labels/details remain contained; review text wraps. No horizontal overflow was found.

Inputs use 16 px text and 48 px minimum height. Main buttons and radio-label targets are 48 px; header and validation text actions meet 44 px. Optional weight uses a decimal keyboard. No fixed overlay obstructs mobile fields.

## Accessibility

Automated WCAG checks found zero violations in the completed visual matrix and the final six theme/stage browser scans. Keyboard checks cover skip link, native radio navigation, required-error focus, review/edit focus, success focus and copy feedback. Hints/errors are associated with controls; reduced motion is respected.

The independent finish reviewer returned **ship**, with no material finding in the inspected presentation/UX. The design detector returned no findings. Manual screen-reader and physical-device testing were not performed.

## Performance

Lighthouse measured the completed production build with intercepted synthetic public catalogs; no live backend write or admin session was used.

| Metric                         | Mobile       | Desktop      |
| ------------------------------ | ------------ | ------------ |
| Performance score              | 91           | 100          |
| Accessibility / best practices | 100 / 100    | 100 / 100    |
| LCP                            | 3326.84 ms   | 690.06 ms    |
| CLS                            | 0.06048      | 0.03444      |
| Total blocking time            | 119.5 ms     | 0 ms         |
| Loaded JavaScript transfer     | 322350 bytes | 322350 bytes |

The public route entry contains 153334 gzip bytes versus 188917 for the dashboard entry and 217988 for an admin module entry, excluding common framework runtime overhead. Built public client references contain no admin shell/auth/operational components; loaded public chunks contain no TanStack Table signatures. No dependency was added.

These are local laboratory measurements, not field INP or authenticated admin timing. Real backend latency and physical-device performance remain unmeasured.

## Live Order Acceptance

**PASS — one disposable order created through the public mobile UI.**

| Evidence              | Observed result                                                |
| --------------------- | -------------------------------------------------------------- |
| Synthetic marker      | `PORTA-QA-20260913-PUBLIC-2240`                                |
| Quote                 | HTTP 200; 1235 millimes = 1.235 LYD                            |
| Creation              | HTTP 201; final price 1235 millimes                            |
| Tracking number       | `PTA-260913-9B906F9B74FA87ED`                                  |
| Returned status       | `RECEIVED`                                                     |
| Duplicate-click check | One order POST; valid idempotency key and CSRF header observed |
| Confirmation          | Returned tracking number and price displayed                   |
| Refresh               | Previous-order notice; still only one order POST               |
| Public isolation      | No staff/admin request from this flow                          |

Existing disposable QA cities A/B, shipment type and SMALL pricing rule were temporarily enabled through the authenticated Admin UI. All four active flags were restored to their prior inactive states and saves verified. The new QA order is retained; no subsequent shipment lifecycle change, capture or refund occurred.

The acceptance harness is explicitly opt-in, allows only one real order request, and writes an attempt marker before forwarding it. It refuses to silently repeat the same QA run. An actual unknown-outcome replay was not forced against the live backend; immutable same-key retries are covered by deterministic API, component and browser tests.

## Testing

- Focused public API/model/provider/form/quote tests: **30 passed in 5 files**.
- Full unit/component suite: **172 passed in 27 files**.
- Playwright: **29 passed** — 16 existing foundation/Admin scenarios and 13 public scenarios.
- Ordinary live Playwright: **4 passed**, including actual public catalogs without staff requests.
- Separately authorized disposable public booking: **1 passed**.
- Generated schema validation, cancellation/races, zero/authoritative money, 422/409/429 handling, immutable retries, privacy, copy failures, empty catalogs, door address, payment selection and refresh are covered.

Testing caught and resolved public radio blur handling, a duplicate notes element ID, quote Retry-After bypass, and the wordmark touch target. Final regression also exposed two test-observation issues: theme contrast measured before a finite transition completed, and an existing foundation locator matching transient content outside the active main landmark. Tests now wait for settled rendering and target the active workspace; assertions were not weakened and Admin application code was not changed. Earlier failed gate logs are retained alongside the final passing log.

## Existing Admin Regression

Existing unit and 16 browser scenarios remain green. The four live checks retain catalog/CSRF/unauthenticated-route coverage. No Admin authentication, shipment, trip, pricing, report, permissions or layout implementation was edited. Public data owns an independent query cache and no staff provider.

## Quality Gates

| Required gate       | Final result              |
| ------------------- | ------------------------- |
| `npm run api:check` | PASS; no contract drift   |
| `npm run lint`      | PASS                      |
| `npm run typecheck` | PASS                      |
| `npm run test`      | PASS; 172 tests           |
| `npm run test:e2e`  | PASS; 29 tests            |
| `npm run test:live` | PASS; 4 tests             |
| `npm run build`     | PASS; 9 prerendered pages |

Unit checks used the established process-local `VITEST_MAX_WORKERS=1`; test assertions/timeouts were not relaxed. Gate timestamps, durations and logs are in `reports/public-order/gates/results.json`.

## Source Changes

New application source:

- `src/app/(public)/layout.tsx`
- `src/app/(public)/order/page.tsx`, `loading.tsx`, `error.tsx`
- `src/features/public-order/api.ts`, `model.ts`, `schema.ts`
- `src/features/public-order/form.tsx`, `use-quote.ts`, `query-provider.tsx`
- `src/features/public-order/fields.tsx`, `summary.tsx`, `success.tsx`, `public-order.css`

Test/tool changes:

- Five new `tests/unit/public-order-*` files, `tests/e2e/public-order.spec.ts`, `tests/live/public-order.spec.ts`, and `tests/acceptance/public-order.live.spec.ts`.
- `tests/e2e/foundation.spec.ts`: scope one existing availability assertion to the active main landmark.
- `playwright.config.ts`: retain the existing foundation project and add an isolated, intercepted public project.
- `playwright.public-order-live.config.ts`: separately guarded, opt-in disposable acceptance.
- `tsconfig.json`: include Next-generated types for the isolated public test build.
- `scripts/check-public-order.mjs`, `scripts/check-public-order-performance.mjs`, `scripts/public-order-check-fixtures.mjs`.
- `.gitignore`: exclude duplicate review captures, interrupted harness artifacts and verbose Lighthouse files.
- Scoped public design brief, `docs/PUBLIC-ORDER-DESIGN.md`, this report, and acceptance evidence under `reports/public-order/`.

No contract, generated API schema, package dependency, existing Admin application file or global design token changed. Next regenerated its environment declaration during checks; its final contents match the baseline.

## Commits and Final Source State

1. `16b591d` — `feat(public-order): add contract-backed public API and validation`
2. `83c541f` — `feat(public-order): implement accessible booking and safe submission`
3. `9e34a09` — `test(public-order): cover browser flows and disposable live acceptance`
4. A final documentation/evidence commit records this report and the completed acceptance.

The final commit hash, branch, clean status, unchanged `main` baseline and ten-entry Git log are recorded after that final commit in [the final source-state record](C:/Users/Mohamed/.codex/visualizations/2026/09/13/01a09a82-f5a8-79a1-aa24-83ca1f166784/porta-public-order-final-source-state.json). This avoids embedding a commit's own hash in its contents. No merge, push, tag or deployment was performed.

## Remaining Gaps

| Classification       | Remaining scope                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FRONTEND GAP         | No confirmed supported-flow defect remains                                                                                                                                                                                                           |
| BACKEND CONTRACT GAP | No blocking public-order capability gap. Weight unit was absent from the contract and explicitly clarified as kg by the user                                                                                                                         |
| TEST DATA GAP        | QA catalogs/pricing are inactive again. The current local public page correctly shows unavailable until approved active catalog/pricing data exists                                                                                                  |
| ENVIRONMENT GAP      | Local Docker/localhost acceptance only; staging DNS/TLS and production deployment remain outside this phase. Lighthouse used isolated catalogs; real-device/screen-reader/field performance and a forced live unknown-outcome replay were not tested |
| DEFERRED FEATURE     | Public Tracking, Driver mobile, GPS, lifecycle discovery, payment processing and deployment remain unimplemented as instructed                                                                                                                       |

## Final Result

**PUBLIC ORDER FORM IMPLEMENTATION PASSED WITH DOCUMENTED GAPS**

The supported public flow passed live creation, tracking/amount confirmation, duplicate prevention, responsive/accessibility checks and every required frontend regression gate. Remaining limitations concern fixtures, environment coverage and explicitly deferred work.

## Evidence Index

- `reports/public-order/live/acceptance.json`, `fixture-restoration.json`, and review/success screenshots.
- `reports/public-order/gates/results.json` and command logs.
- `reports/public-order/visual/results.json` and 32 completed-state screenshots.
- `reports/public-order/performance/results.json` and `bundle-isolation.json`.
- `reports/public-order/theme-timing.json`, `reviews.json`, and `design-detector.json`.

Visual fixtures are labelled test data and never enter the application or real API. Raw Lighthouse artifacts remain available locally but are excluded from Git.
