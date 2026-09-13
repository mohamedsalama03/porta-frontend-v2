# Porta API integration gaps and acceptance record

Updated 13 September 2026. This replaces the earlier missing-origin/missing-contract foundation assessment.

## Approved inputs now available

- Local API: `http://localhost:8080`, supplied by the user; configured through `NEXT_PUBLIC_API_BASE_URL`.
- Local contract: `contracts/porta-api-v1.openapi.json`, OpenAPI 3.1.0, API 1.0.0, requested baseline `c2682c4e5ee01beefd1ef467a1df303a79409b08`.
- Browser origin: `http://localhost:3000`. Actual responses allow this origin with credentials.
- Generated Zod schemas and TypeScript types: `src/lib/api/generated.ts`.

No backend repository was located, opened or changed. No database access, domain-rule replication, remote schema discovery or invented HTTP endpoint was used.

## Actual HTTP evidence

`reports/integration/http-check.json` records GET CSRF **204**, unauthenticated session discovery **401**, cities **200**, and shipment types **200**. JSON responses pass generated validation. Both public catalogs returned empty arrays on the recorded run; no catalog data has been invented or seeded by the frontend.

Browser tests against the actual API confirm readable `XSRF-TOKEN`, an HttpOnly SameSite=Lax session cookie on localhost, enabled configured login, and safe unauthenticated redirects. The local environment uses HTTP as explicitly approved. These checks do not prove a successful staff login, authenticated reads, authorization scopes or business writes.

The user signed in manually and browser inspection recovered. Authenticated shipment, trip, driver, city, branch, shipment-type and pricing lists rendered empty results. The city editor opened and closed with focus restored, and shipment creation remained disabled with the actual empty catalogs. No credentials or authenticated browser storage were extracted or persisted. No operational or financial writes were performed.

The authenticated dashboard report currently fails the supplied schema at the grouped shipment counts by status, origin city and destination city. Each of `data.shipments_by_status`, `data.shipments_by_origin_city` and `data.shipments_by_destination_city` contains a **string** entry where the approved contract requires a **nonnegative integer**. Safe diagnostics confirmed the received JSON kind on 13 September 2026 at 12:59 UTC; request reference `23534a86-53f7-4d34-ae8e-2393fb9eb592`. The generated validators match the contract. No values were coerced or raw response bodies persisted. This needs the local response and the approved contract brought into agreement before report acceptance can pass.

## Missing API capabilities

| Capability                          | Evidence in supplied contract                                                                                                      | Frontend handling / required addition                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shipment timeline                   | Admin `Shipment` contains current state and timestamps, without an event history. Public tracking is a separate out-of-scope flow. | No invented timeline or public-tracking workaround. Provide an authorized admin history projection.                                                        |
| Allowed next shipment/trip actions  | Status write inputs enumerate states, but records do not expose their currently allowed transitions or action capabilities.        | Lifecycle controls stay unavailable; do not reproduce a state machine in the browser. Provide current allowed actions with authoritative refresh behavior. |
| Quote fee breakdown                 | `Quote` exposes calculated/final price, currency and scale, without separate base/surcharge amounts.                               | Show only supplied totals. Provide a quote breakdown to display separate fees.                                                                             |
| Aggregate payment list/export       | Payments are documented only beneath a shipment ID with cursor metadata.                                                           | Payment screen opens a shipment ledger; no aggregate financial query is invented.                                                                          |
| Arbitrary permission editor         | `UserPatch` documents role, branch and active state, without a permission-assignment catalog/write schema.                         | Show/edit documented staff fields; session permissions remain authoritative. No invented permission matrix writes.                                         |
| Notifications                       | No notification list/count/read-state operation.                                                                                   | Keep notification area without fabricated counts or polling.                                                                                               |
| Organization settings / export jobs | No settings or export operation.                                                                                                   | Settings remain local theme/density preferences. No backend settings writes or export endpoint assumptions.                                                |
| Driver eligibility                  | Driver lists exist; no assignment-specific eligible-candidates operation.                                                          | Display authorized driver choices/IDs and allow the API to accept or reject assignment. Do not calculate eligibility.                                      |
| Global command lookup               | No general staff search endpoint; shipment list has documented bounded search.                                                     | Command palette searches navigation only; shipment search uses its own server filters.                                                                     |

## Deployment and response-header gaps

Actual responses expose `X-Request-ID` and `Idempotency-Replayed`, but do not expose `Retry-After` through CORS. A cross-origin browser cannot read an unexposed response header. The client honors readable retry delays and does not automatically retry a 429 when its delay is unavailable. Add `Retry-After` to the approved backend CORS exposure before validating exact browser rate-limit timing; this is a backend task, not a frontend workaround.

Use `localhost` on both sides locally: cookies on localhost are not readable from a frontend visited as 127.0.0.1. No production/staging API origin or final DNS/TLS settings have been approved. Public environment variables must be supplied before the production build. The running backend commit cannot be established from the documented public contract alone; the hash in this document is the user's approved baseline, not a claim to have inspected its source.

## Required authenticated acceptance checks

These remain separate from unit/component tests and unauthenticated HTTP checks:

1. The existing staff session and authoritative current-user discovery were observed; login submission, rejected credentials, expiry and confirmed logout still need live checks.
2. Resolve the report response mismatch, then verify actual report aggregates, populated scoped lists, permission-denied and branch/driver ownership cases.
3. With approved disposable catalog/pricing records: shipment quote/create/detail/contact edit/driver assignment, server pagination and filter retention.
4. Trip/driver create and edit; atomic trip attachment and detachment; conflict refresh against concurrent changes.
5. Catalog activation and pricing changes; role/branch/account changes with protections enforced by the service.
6. Shipment payment ledger and approved disposable capture/failure/full-refund scenarios. Financial test writes must use explicitly designated local test records.
7. Identical critical-write replay with the same idempotency key/body, mismatch conflict, field validation, service failures and readable rate-limit timing.

The empty public catalogs currently prevent a successful meaningful shipment quote/create workflow until approved data exists. Do not create invented production records to satisfy a test. When a capability is supplied, update only its dependent integration and run the associated acceptance checks.

Public order intake, public tracking, driver mobile work, GPS/live tracking and deployment remain outside this task's stop boundary.
