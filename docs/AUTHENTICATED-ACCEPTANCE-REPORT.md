# PORTA DELIVERY

# NEXT.JS AUTHENTICATED ACCEPTANCE REPORT

13 September 2026 · Retest after backend integration remediation.

**AUTHENTICATED ACCEPTANCE NOT PASSED**

The reports remediation passes frontend validation. A separate integration failure remains: pricing and driver activity filters return validation errors for the contract-declared Boolean query values. Unfiltered reads and the regression gates pass. No application source, contract, credentials or operational data were changed.

## Frontend Revision

Workspace: `D:\customers\porta frontend`.

Before changes, all three requested Git commands were run: `git status --porcelain=v1`, `git branch --show-current`, and `git rev-parse HEAD`. Each returned **not a git repository**. A frontend commit, branch and clean-worktree status cannot be certified; no repository was initialized or searched for elsewhere.

Instead, [baseline.json](../reports/acceptance/baseline.json) records SHA-256 hashes of 166 existing source, test, script, contract, configuration and documentation files. [source-comparison.json](../reports/acceptance/source-comparison.json) confirms all 166 remain unchanged. New acceptance documentation/evidence is listed below.

## Backend Under Integration

User-supplied remediation revision: **`b3a55e94673838b0c264a77459017a50aa8078e7`**. This identifies the backend under test as supplied by the user; no documented response exposes its running commit for independent verification.

No Laravel repository, PHP source, database, migrations or backend configuration were accessed or modified.

## API

`http://localhost:8080` through `NEXT_PUBLIC_API_BASE_URL`; connected mode is enabled. The authenticated frontend remains at `http://localhost:3000`.

## OpenAPI Contract

`contracts/porta-api-v1.openapi.json` remains unchanged.

SHA-256: **`90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4`**.

The existing generated validators were used without coercion or regeneration. `npm run api:check` passes.

## Authentication

**PASS — existing authenticated session and session discovery.** The user-established staff session remained valid across reloads. Protected pages rendered after the existing current-user validator and permission checks. No credentials or cookie values were requested, exported or saved.

The separate real-browser/public-HTTP suite passes CSRF bootstrap, readable CSRF cookie/HttpOnly session-cookie checks, unauthenticated `/api/v1/auth/me` returning 401, and protected-route login redirection with a safe return path. Cookie evidence contains only names and flags.

Users and audit navigation remained absent. Direct visits to both frontend routes displayed the permission-denied screen. This is correct handling for the current account, not a failure. Staff/audit backend reads were not forced past these guards.

Login submission and logout were not repeated: the requested existing session was reused and left signed in. Cross-branch ownership and alternate-account permissions need designated test accounts/data.

## Reports Retest

**REPORTS FRONTEND INTEGRATION: PASS**

| Check                    | Result | Evidence and scope                                                                                                                                                                                                            |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache-miss scenario      | PASS   | An explicit refresh after the documented 60-second interval rendered successfully; the displayed generation time advanced from 15:37 to 15:39 Libya time.                                                                     |
| Cache-hit scenario       | PASS   | An immediate second explicit refresh also rendered successfully with the same displayed generation time.                                                                                                                      |
| Schema validation        | PASS   | Dashboard and detailed reports rendered through the unchanged `getAdminReportsResponseSchema`.                                                                                                                                |
| Three grouped-count maps | PASS   | `shipments_by_status`, `shipments_by_origin_city`, and `shipments_by_destination_city` passed the existing object/nonnegative-integer validators. Current data is empty; populated map entries remain a data-dependent check. |
| Date filter and recovery | PASS   | A range exceeding 366 days produced the HTTP-422-specific safe message and a support reference; resetting the range restored the report.                                                                                      |

Cache miss/hit labels above describe the fresh and repeated request scenarios. Server cache status is **inferred**, not directly instrumented: the contract provides a TTL and `generated_at`, but no hit/miss flag or exposed cache-status header. UI timestamps display minute precision. Navigation alone was not counted as a server cache hit; explicit refresh controls were used.

One earlier schema warning at 13:35:59 UTC preceded the successful refreshed report. No new report-schema warning was observed after the successful requests from 13:37 UTC onward. The frontend did not convert strings into integers or weaken the validators.

Oversized-range support reference: `ccda45cd-a06d-404d-a47b-ac0683fe84b5`.

## Retry-After

**CORS exposure: PASS.** Actual public responses now expose `Retry-After`, `X-Request-ID`, and `Idempotency-Replayed`, allow `http://localhost:3000`, and allow credentials. See [http-check.json](../reports/integration/http-check.json).

**Header visible to browser on a real 429: NOT VERIFIED.** No approved safe 429 trigger was documented in this frontend. The mechanism was requested from the user and remained unavailable during this retest. No throttles were changed and no traffic was generated merely to exhaust a rate limit.

**RETRY-AFTER FRONTEND INTEGRATION: NOT TESTED — ENVIRONMENT GAP.** This is not a demonstrated failure, and CORS exposure alone is not sufficient to mark the requested real-429 browser test PASS.

Existing tests pass for readable Retry-After timing, grouped read retry controls, explicit mutation retry delay, same-key preservation, bounded safe read retries, and no automatic mutation retries. These tests are distinct from live 429 acceptance.

## Authenticated Read Matrix

| Screen / behavior                | Status         | Actual result                                                                                                                        |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard                        | PASS           | Valid empty aggregates, charts/empty states and report refreshes.                                                                    |
| Reports                          | PASS           | Valid report, expanded daily table, date validation/recovery.                                                                        |
| Shipments                        | NO DATA        | Empty list renders; `status=IN_TRANSIT` filter and clearing work; zero-row cursor controls are disabled.                             |
| Shipment detail                  | NO DATA        | No real record available. One read-only missing-ID lookup produced the safe 404 message and request reference.                       |
| Trips                            | NO DATA        | Empty cursor list renders; `status=SCHEDULED` filter and clearing work.                                                              |
| Drivers, unfiltered              | NO DATA        | Empty cursor list renders, with permitted create action.                                                                             |
| Drivers, active filter           | FAIL           | `active=true` returns the HTTP-422-specific validation display.                                                                      |
| Cities                           | NO DATA        | Empty page 1 of 1; create dialog opens without a write.                                                                              |
| Branches                         | NO DATA        | Empty page 1 of 1 and permitted create action.                                                                                       |
| Shipment types                   | NO DATA        | Empty page 1 of 1 and permitted create action.                                                                                       |
| Pricing, unfiltered              | NO DATA        | Empty page 1 of 1 renders.                                                                                                           |
| Pricing, active/inactive filters | FAIL           | Both `active=true` and `active=false` return validation errors; selection persists after reload. Clearing restores the working list. |
| Payments                         | NO DATA        | Entry screen correctly requires a shipment identifier; no ledger fixture exists.                                                     |
| Users                            | NOT AUTHORIZED | Hidden navigation and safe direct-route denial.                                                                                      |
| Audit                            | NOT AUTHORIZED | Hidden navigation and safe direct-route denial.                                                                                      |

The loading-to-result path, empty states and returned zero-page metadata were observed. Populated rows, next-page cursors, long record labels, successful real detail navigation and ownership scopes remain untested because no suitable records were available. No records were fabricated.

## Activity-Filter Integration Failure

The same staff session loads the unfiltered lists, then receives a validation error after the filter is applied:

| API query issued by the existing frontend  | Observed result   | Support reference                      |
| ------------------------------------------ | ----------------- | -------------------------------------- |
| `/api/v1/admin/pricing-rules?active=false` | HTTP 422 handling | `8c2633bf-40b9-451e-a601-775e04272c6b` |
| `/api/v1/admin/pricing-rules?active=true`  | HTTP 422 handling | `c89e399f-94a2-4526-ad71-25e9a29e19cd` |
| `/api/v1/admin/drivers?active=true`        | HTTP 422 handling | `d39647cb-a2c9-42fd-af70-43e04fa5bcdf` |

The UI message is selected exclusively by status 422 in the existing safe error mapper; the response body and cookies were not exported. The frontend filter URL and corresponding source adapter establish the issued query. The backend validation field itself is not shown by the generic UI, so its internal rejection reason is not asserted here.

Both contract parameters are optional Booleans with no documented alternate encoding. The frontend parses the selection to a Boolean and serializes literal `true`/`false`, preserving false rather than dropping it. No frontend contract violation has been demonstrated. Classification: **BACKEND CONTRACT GAP — unresolved Boolean-query interoperability**. The response parser/validator and the approved wire contract must be brought into agreement; do not silently switch to an undocumented `0/1` convention.

The shipment driver-choice adapter also sends `active=true&per_page=25`, so the driver-filter rejection is expected to affect that lookup. This impact follows from the adapter; an actual assignment dialog could not be tested without a shipment. Trip reference lookups omit `active` and are not implicated by this evidence. JSON Boolean fields in writes were not tested and are not classified as failing.

## Empty Catalog Behavior

**PASS.** Actual public cities and shipment types still return empty arrays. The authenticated shipment form contains zero usable origin-city, destination-city and shipment-type choices, and its create button remains disabled. No invented choice or price is displayed. Form controls retain accessible labels.

## Authenticated Write Matrix

No designated disposable fixtures or test namespace were supplied. A visible permitted create action is not proof that a submitted write would succeed.

| Supported workflow                  | Result                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Create/edit city                    | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/edit branch                  | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/edit shipment type           | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/edit driver                  | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/edit trip                    | NOT TESTED — TEST DATA REQUIRED                                            |
| Create shipment                     | NOT TESTED — TEST DATA REQUIRED                                            |
| Edit shipment contact/address/notes | NOT TESTED — TEST DATA REQUIRED                                            |
| Assign driver                       | NOT TESTED — TEST DATA REQUIRED; active-driver query mismatch also remains |
| Attach/detach trip shipment         | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/update pricing rule          | NOT TESTED — TEST DATA REQUIRED                                            |
| Create/edit staff user              | NOT AUTHORIZED                                                             |

No operational write, delete, activation change, account update or lifecycle mutation was performed.

## Payment Acceptance

Read-entry/empty-state behavior passes. An actual immutable ledger, amounts, capture, failure and refund require an approved shipment/payment fixture.

**Payment writes: NOT TESTED — SAFE PAYMENT FIXTURE REQUIRED.** No financial transaction was created.

## Idempotency / Conflict UX

**Live acceptance: NOT TESTED — TEST DATA REQUIRED.** No naturally available 409 or approved replay fixture existed. Same-key retries, conflict messaging, retained payloads, authoritative invalidation and unsafe automatic retry prevention remain covered by the passing unit/component suite; this does not certify live replay behavior.

## Lifecycle Integration

**LIFECYCLE UI: DEFERRED PENDING BACKEND CONTRACT EXTENSION**

The existing unavailable lifecycle controls were preserved. No transition sequence, eligibility rule, probing mutation or public-tracking workaround was introduced.

## Real Error Handling

| Case              | Result                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401               | PASS: real unauthenticated discovery and protected-route redirect in existing live tests.                                                                         |
| Permission denial | PASS for frontend guards: users/audit hidden and direct routes denied. An actual backend 403 was not forced.                                                      |
| 404               | PASS: a single read-only lookup of a nonexistent valid-format shipment ID displayed the safe not-found message. Reference `b426126b-9319-4511-adab-b3f7efc89b5e`. |
| 422               | PASS for error presentation and recovery on oversized report range. Activity-filter 422s are the separate integration failure above.                              |
| 409               | NOT TESTED — disposable concurrency/replay fixture required.                                                                                                      |
| 429               | NOT TESTED — approved safe trigger required.                                                                                                                      |

Provided request IDs remained visible without exposing backend prose, SQL, stacks or cookie values.

## Responsive

Authenticated desktop rendering passes at the actual browser content width of approximately 1037–1052 CSS pixels. Dashboard, reports, shipments, trips and pricing retained RTL layout and had no document-level horizontal overflow. Empty tables and the city dialog were inspected.

**Authenticated tablet/mobile: NOT TESTED — ENVIRONMENT GAP.** The documented viewport control accepted 1440-pixel and 390-pixel overrides but the observed layout remained approximately 1052 pixels, including after reload. The override was reset. A resized screenshot was not substituted for real responsive behavior.

The existing foundation Playwright mobile/drawer/overflow checks pass, but they do not establish authenticated phone/tablet acceptance. Real detail layouts and long labels need populated fixtures.

## Accessibility

Existing automated accessibility gates pass in the foundation Playwright suite and real login test; their scope was not changed. Authenticated manual checks confirm RTL, labelled shipment fields and city-dialog fields, keyboard entry into the dialog, forward Tab navigation, Escape dismissal and focus restoration to the opener. Permission-denied content is explicit and empty tables have captions/headings.

An authenticated axe scan and complete reduced-motion/assistive-technology pass were not executed. The supported browser interface provides read-only DOM inspection, not the script injection/profile access used by the repository's independent Playwright/axe process. The signed-in browser's credentials were not copied into another automation profile. Foundation reduced-motion tests remain passing.

## Performance

Authenticated Lighthouse, LCP, CLS, total blocking time and render profiling remain **NOT TESTED — ENVIRONMENT GAP**. The current browser's read-only evaluation scope does not expose the Performance API. The existing Lighthouse script launches a separate unauthenticated profile and labels its results as foundation measurements; running it against a redirect to login would not measure authenticated screens. Historical scores were not overwritten or relabelled.

An available production asset measurement was collected using the existing production build, without cookies or script execution:

| Production route | HTML-listed script resources | Decoded resource bytes |
| ---------------- | ---------------------------: | ---------------------: |
| Dashboard        |                           18 |              1,293,005 |
| Shipments        |                           20 |              1,404,611 |
| Trips            |                           20 |              1,404,611 |
| Pricing          |                           20 |              1,404,611 |
| Reports          |                           20 |              1,404,611 |

These are uncompressed resource footprints of scripts listed in server HTML, **not initial transferred JS or authenticated performance**. Dynamic chunks not listed in HTML, browser execution, caching and layout metrics are excluded. The footprint identifies work to profile once authenticated performance tooling is available; it does not by itself demonstrate a frontend defect or production SLA. Method and per-resource evidence are in [production-script-footprint.json](../reports/acceptance/production-script-footprint.json).

## API Contract Drift

**PASS.** Existing generated file matches the approved unchanged contract; all recorded baseline source/configuration hashes remain unchanged.

## Unit Tests

**PASS — 139 tests across 22 files**, using the repository's `npm run test` script.

## Playwright

**PASS — 16 foundation browser scenarios and 3 real-API browser scenarios**, using `npm run test:e2e` and `npm run test:live`. The latter covers actual public responses, browser CSRF/session-cookie setup and unauthenticated routing. Authenticated manual checks are separately identified above.

## Lint / TypeScript

**PASS** — `npm run lint` and `npm run typecheck`. No gates or thresholds were weakened.

## Production Build

**PASS** — `npm run build`, including its contract-check prebuild hook. The isolated production smoke check passes: four preview routes return 404, login returns 200 with configured sign-in enabled, preview entry hidden and noindex headers present. The temporary production server was stopped and the existing staff session/server preserved.

## Frontend Changes

**Application source, tests, dependencies, environment configuration and OpenAPI: no changes.** No frontend fix was justified by the observed contract-compliant Boolean serialization, and missing fixtures did not trigger implementation changes.

New acceptance deliverables:

- `docs/AUTHENTICATED-ACCEPTANCE-REPORT.md`
- `reports/acceptance/baseline.json`
- `reports/acceptance/source-comparison.json`
- `reports/acceptance/results.json`
- `reports/acceptance/production-script-footprint.json`

Existing evidence rewritten by the unchanged verification scripts:

- `reports/integration/http-check.json`
- `reports/production-check.json`
- `playwright-report/index.html`
- `test-results/.last-run.json`

Normal generated build/test caches under `.next`, `.next-foundation-test` and `tsconfig.tsbuildinfo` refreshed. Previous implementation and acceptance evidence were retained as historical records.

## Remaining Integration Gaps

| Classification       | Gap / required next step                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BACKEND CONTRACT GAP | Resolve literal Boolean `active=true/false` rejection for pricing/drivers; retest filters and active-driver choices.                                                              |
| BACKEND CONTRACT GAP | Per-record allowed lifecycle actions/history remain unavailable.                                                                                                                  |
| TEST DATA GAP        | Designated disposable catalogs, pricing, users, drivers, trips, shipments and scoped accounts are required for populated reads, writes, replay/conflict and ownership acceptance. |
| TEST DATA GAP        | Explicitly authorized safe payment fixture required for payment writes.                                                                                                           |
| ENVIRONMENT GAP      | Approved safe real-429 mechanism needed; CORS exposure itself is confirmed corrected.                                                                                             |
| ENVIRONMENT GAP      | Git metadata unavailable; frontend revision/clean-worktree status cannot be certified.                                                                                            |
| ENVIRONMENT GAP      | Authenticated phone/tablet sizing, axe and Lighthouse/profiling need a supported browser/test setup without credential export.                                                    |
| ENVIRONMENT GAP      | Cache scenarios pass response validation, but explicit server hit/miss telemetry is unavailable.                                                                                  |
| DEFERRED FEATURE     | Lifecycle controls, public order/tracking, driver mobile, GPS and deployment remain outside this acceptance scope.                                                                |
| FRONTEND DEFECT      | None demonstrated that warrants a source change in this retest. The activity-filter integration failure remains open rather than being hidden by an undocumented encoding change. |

## Final Result

**AUTHENTICATED ACCEPTANCE NOT PASSED**

Reports are corrected and automated regression gates are green, but the reproduced activity-filter integration failure prevents acceptance. Resolve that response/contract mismatch and rerun its affected reads. Complete fixture-dependent and environment-dependent checks separately; their absence is not counted as a failed write workflow.
