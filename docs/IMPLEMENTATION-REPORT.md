# PORTA DELIVERY — ADMIN DASHBOARD IMPLEMENTATION REPORT

**13 September 2026 · Local API integration implemented; authenticated read checks completed with a report-contract mismatch.**

This delivery extends the previously verified standalone foundation with contract-backed data screens and write controls. It is not a claim that all workflows have been exercised successfully against the running backend. Missing API capabilities and the authenticated acceptance checklist are recorded in [API-INTEGRATION-GAPS.md](API-INTEGRATION-GAPS.md).

## Platform and boundaries

Next.js **16.3.5**, App Router, React **19.3.0**, strict TypeScript, Tailwind, Cairo through next/font, Motion, React Hook Form/Zod, TanStack Query and TanStack Table. Dependencies remain locked. The application is Arabic-first with RTL layout and logical spacing.

The user-approved local origin is configured as `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`. The frontend must be visited as `http://localhost:3000` for the approved local cookie/CORS setup. Production/staging DNS and TLS remain unapproved.

The contract is the user-supplied `contracts/porta-api-v1.openapi.json`, OpenAPI 3.1.0 / API 1.0.0, associated by the user with baseline `c2682c4e5ee01beefd1ef467a1df303a79409b08`. Its SHA-256 is `90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4`. The running container's commit has not been inferred from this file.

All work stays in this independent frontend. No backend source, sibling repository, PHP, database or migrations were accessed or changed. The contract itself was preserved. No backend domain rules or fictitious HTTP endpoints were created.

## Architecture

Server components select routes and supply layouts, metadata, loading/error boundaries and recovery pages. Client components own interactive forms, filters, tables, dialogs and authenticated queries. Private operational content is fetched only after browser session/permission checks; the static server shell contains no private API data.

`src/lib/api/client.ts` remains the only backend transport. It supplies cookie credentials, Sanctum CSRF, decoded `X-XSRF-TOKEN`, no persistent response cache, cancellation, same-origin API-path validation and safe errors. It rejects duplicate API query keys, non-object JSON, JSON over 65,536 bytes and idempotency keys outside the documented 32–128-character alphabet.

A deterministic frontend-only generator produces 63 component validators/types and validators/metadata for 51 contract operations. It preserves required envelopes, enum values, string/number limits, nullability, unique bulk identifiers and conditional required inputs. Unsupported validation keywords fail generation rather than being silently ignored. The generated file is checked for drift with `npm run api:check`, also run automatically before production builds.

TanStack Query remains in-memory. Lists use actual server cursor/page metadata, bounded page sizes and cancellation. Filters are URL-backed. Mutations wait for authoritative success, retain a key and body for controlled retries, and invalidate affected resources. Uncertain write outcomes lock the original payload instead of silently creating a new attempt. No optimistic shipment, trip or financial state is applied.

## Authentication and permissions

Approved authentication operations are `/sanctum/csrf-cookie`, `/api/v1/auth/login`, `/api/v1/auth/me`, and `/api/v1/auth/logout`. Login validates the documented request and response, then derives the session from the authoritative current-user endpoint. Logout waits for confirmation; failed logout does not pretend the server session has ended.

Session expiry clears private queries and identity, preserves a safe return path and avoids redirect loops. Login without an explicit return path chooses the first permitted workspace. Local preferences are the only persisted browser state; no bearer/auth token or API payload is stored in localStorage/sessionStorage.

Navigation uses exact documented permissions: reports.view for dashboard/reports, cities.manage for cities/branches, pricing.view for shipment types/pricing reads, pricing.manage for their writes, payments.manage for payments, users.manage for staff, and the documented shipment/trip/driver/audit permissions. No role implies another permission. Local settings need only an authenticated subject. Create routes check their exact write capability independently from list access. The backend continues to authorize every operation and scope.

## Delivered screens and operations

| Route                                       | Implemented behavior                                                                                                                    | Documented API integration                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/login`                                    | Staff session form, validation, secure-cookie flow, recovery and safe redirect                                                          | Auth login/me/logout and Sanctum bootstrap                                   |
| `/dashboard`                                | Returned totals, delivery states, active trips, net revenue, date series and destination summaries; accurate empty/absent states        | `GET /api/v1/admin/reports`, active city/type display catalogs               |
| `/shipments`                                | TanStack table, documented search/filter/sort, URL retention, cursor pagination, column visibility and real record links                | `GET /api/v1/admin/shipments`                                                |
| `/shipments/new`                            | Multi-section RHF form, real catalog choices, debounced cancellable quote, stale-quote lockout, confirmed creation and controlled retry | `POST /api/v1/quotes`, `POST /api/v1/admin/shipments`                        |
| `/shipments/[id]`                           | Real sender/recipient/route/payment details, safe contact/address/notes edits, explicit driver assignment, payment review controls      | Shipment GET/PATCH, POST driver, paged driver choices, shipment payment POST |
| `/trips`, `/trips/new`, `/trips/[id]`       | Authorized lists/filters/detail, creation/editing, assigned-shipment cursor list and deliberate atomic attach/detach                    | Admin trip GET/POST/PATCH, trip shipments GET/POST/DELETE                    |
| `/drivers`, `/drivers/new`, `/drivers/[id]` | Authorized lists/detail, active filter, profile creation/editing and documented account association                                     | Admin driver GET/POST/PATCH                                                  |
| `/cities`, `/branches`                      | Server-paged tables, create/edit, changed-field PATCH and active-state controls                                                         | Admin cities/branches GET/POST/PATCH                                         |
| `/shipment-types`, `/pricing`               | Server-paged tables, real filters, create/edit/active controls, exact LYD decimal-to-millime input conversion and dated pricing         | Admin shipment-types/pricing-rules GET/POST/PATCH                            |
| `/payments`                                 | Shipment-specific immutable ledger, cursor navigation and exact signed amounts; link to permitted shipment payment controls             | `GET /api/v1/admin/shipments/{shipment}/payments`                            |
| `/reports`                                  | URL-backed business-date filters, returned aggregates and lightweight accessible charts/tables                                          | `GET /api/v1/admin/reports`                                                  |
| `/users`                                    | Cursor list, create account and edit documented role/branch/active fields; session refresh after access changes                         | Admin users GET/POST/PATCH                                                   |
| `/audit`                                    | Cursor list with safe action/entity summaries and times; no raw before/after/internal metadata rendering                                | `GET /api/v1/admin/audit-logs`                                               |
| `/settings`                                 | Local theme and density preferences                                                                                                     | No settings API is invented                                                  |

Public active catalogs supply display names and selections; empty results remain empty. Driver assignment is submitted to the service for eligibility checks. Prices and amounts are never calculated from frontend business rules. The quote screen shows only returned calculated/final totals, because a separate fee breakdown is not supplied.

The two lifecycle status-write endpoints remain unwired to selectable next-state controls: the contract enumerates states but does not give per-record allowed next actions. No timeline events are fabricated. There is no aggregate payments API, generic permission editor, notification API or organization-settings API. These are specific integration gaps, not a reason to stop unrelated frontend work.

## UI, motion and performance

The established restrained green/neutral visual system remains intact: right-side desktop navigation, collapsible sidebar, mobile drawer, command navigation, account controls, compact data surfaces, contextual feedback and dark mode. The command palette searches pages; it does not pretend to search every operational record.

Motion is lazy-loaded, subtle and reduced-motion aware. Page content starts visible to avoid hydration-dependent blank screens. Native dialogs and focus helpers provide keyboard containment and focus restoration. Forms have labels and inline errors; tables have empty/loading/error states, bounded row counts and overflow containment. Charts use lightweight SVG plus accessible data tables instead of a large chart runtime.

Money display uses exact integer millimes and three decimal places. Business dates/timestamps are presented in Africa/Tripoli. No client-side fetch-all pagination, private query persistence or financial optimistic updates were added.

The earlier foundation-only Lighthouse scores (92 login / 91 dashboard, simulated mobile) remain historical evidence in `reports/performance`. They are not a performance claim about the new authenticated features. Those screens still require an authenticated production performance/accessibility pass with actual data, including responsive dialogs and long records.

## Verification

- Generated-schema drift check passes against the supplied unchanged contract.
- Strict TypeScript checks and production compilation pass.
- **139** unit/component tests pass, covering API safety, exact permissions, session lifecycle, cursor validation, conditional inputs, money precision, mutations, uncertain retry preservation, cache invalidation, Retry-After controls and privacy-safe diagnostics/mappings.
- **16** foundation Playwright scenarios pass, including RTL, mobile navigation, keyboard dialogs, preferences, isolated shipment previews, dark/light accessibility and reduced motion.
- **3** Playwright scenarios against the **actual local API** pass: public response contracts, browser cookie/CORS/session behavior, enabled login/accessibility, and unauthenticated protected-route redirects. No fake backend is used for this suite.
- The read-only HTTP probe passes for CSRF 204, unauthenticated me 401, cities 200 and types 200. Both public catalogs were empty. Evidence is in `reports/integration/http-check.json`, without cookie values or private payloads.
- Production smoke checks pass: preview routes return 404, configured login renders without a preview entry, and admin indexing/security headers remain present. Evidence is in `reports/production-check.json`.

The user signed in manually, and browser inspection became available. The authenticated shipment, trip, driver, city, branch, shipment-type and pricing lists rendered their actual empty results. The city editor opened and returned keyboard focus on Escape without a submission. The shipment creation form rendered its real empty catalog choices and kept creation disabled. The payment entry screen correctly required a shipment identifier. Navigation omitted staff/audit sections for this session.

The dashboard's actual report response failed the approved schema at `shipments_by_status`, `shipments_by_origin_city` and `shipments_by_destination_city`: each map contains a string entry where the contract requires a nonnegative integer. This remains an explicit integration mismatch; the generated validators match the contract and validation stays strict. Development-only diagnostics expose schema-owned paths and JSON kinds, without response values, dynamic identifiers, credentials or request queries. Details and a request reference are in the integration-gap record.

No approved staff credentials or disposable operational records were supplied to automated tests. Login submission itself, confirmed logout, populated records, branch/driver scopes, write acceptance, conflict/replay behavior and payment workflows remain unverified against the real service. The existing authenticated session was left signed in, and no operational or financial writes were performed.

Actual responses currently omit `Retry-After` from exposed CORS headers. The client honors readable delays and avoids automatic 429 retries without one; complete browser rate-limit timing needs the backend CORS exposure corrected in its separate task.

## Release boundary

The frontend is buildable and the supplied API is configured. Keep the remaining authenticated acceptance checks and explicit API gaps open. Do not describe this as a fully verified operational release until those checks pass. Public order intake, public tracking, driver mobile work, GPS/live tracking and production deployment were not started.
