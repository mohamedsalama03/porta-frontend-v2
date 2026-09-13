# PORTA DELIVERY

# NEXT.JS BOOLEAN FILTER ACCEPTANCE RETEST

13 September 2026 · Focused retest of the previously rejected Boolean filters.

## Backend Revision

`02770a1bf7633203b928cfe48948962c9597019c`, supplied by the user as the backend revision under integration. Its running commit is not independently exposed by the documented API. No backend repository was accessed.

## API

`http://localhost:8080`. The existing frontend configuration remains `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`, with the browser at `http://localhost:3000`.

## OpenAPI

Path: `contracts/porta-api-v1.openapi.json`.

SHA-256: **`90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4`**.

**Drift check: PASS.** The contract and generated validators were neither edited nor regenerated. The existing `npm run api:check` confirms alignment.

## Source Baseline

The requested Git status, branch and HEAD commands still report that this directory is not a Git repository. Git was not initialized. The prior source-hash method was retained: [baseline.json](../reports/boolean-filter-retest/baseline.json) records 167 existing source, test, script, configuration, contract and documentation files before the retest.

## Authentication

**PASS.** The existing staff session remained valid across the fresh page loads and reloads. No login was submitted again, no credentials were requested, and no cookies were exported or copied to another browser profile. The session remains signed in.

## Drivers

| Case                      | Result   | Observed behavior                                                                                                                                                                     |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active=true`             | **PASS** | Valid empty list; URL and selected value remain literal `true` after reload; no validation or schema error.                                                                           |
| `active=false`            | **PASS** | Valid empty list; URL and selected value remain literal `false` after reload. False was not dropped, inverted, omitted or converted to zero.                                          |
| Unfiltered                | **PASS** | Clearing removes `active`; the unfiltered URL and empty selection persist after reload, and the list renders normally.                                                                |
| `active=true&per_page=25` | **PASS** | The existing driver-list integration path accepts the identical first-page request used by the assignment adapter, through the same centralized client and driver response validator. |

**ACTIVE DRIVER LOOKUP: PASS.** The lookup used `/drivers?active=true&per_page=25` in the existing frontend, which issues `GET /api/v1/admin/drivers?active=true&per_page=25`. No shipment was needed. This verifies the equivalent read integration, not opening an assignment dialog or performing assignment.

## Pricing

| Case           | Result   | Observed behavior                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `active=true`  | **PASS** | Valid empty list; literal `true` remains in URL/selection after reload; no validation or schema error. |
| `active=false` | **PASS** | Valid empty list; literal `false` remains in URL/selection after reload; no numeric alias or omission. |
| Unfiltered     | **PASS** | Clearing removes `active`; the unfiltered page continues to render after reload.                       |

Evidence is in [browser-check.json](../reports/boolean-filter-retest/browser-check.json). Filter selections were applied through the rendered controls, followed by full reloads. The lookup used the existing driver-list adapter; source review confirms its exact request matches the assignment adapter. Expected successful status is HTTP 200 under the contract. The controlled browser interface did not export raw network status/headers; the observed evidence is a successful HTTP result accepted by the existing client and generated validator, a rendered list/empty state, and the absence of the previous 422 display. No wire trace or private response body is claimed.

Both collections remain empty. Record-level active/inactive membership could not be demonstrated with this data, and no records were created. Valid empty responses are within the specified focused acceptance scope.

## Reports Smoke

**PASS.** One fresh authenticated dashboard load rendered the report metrics and empty states through the unchanged reports validator, without a schema validation message. The wider reports/cache campaign was not repeated.

## Frontend Serialization

**Canonical `true`/`false` retained; `1`/`0` not introduced.**

The existing URL parser preserves Boolean false, the query serializer emits the canonical string values, and clearing the filter omits the parameter. The assignment adapter still uses `active=true&per_page=25`. No retry-with-numeric-alias fallback, response coercion or compatibility workaround was added.

Reviewed application paths:

- `src/features/operations/model.ts` — URL parsing and serialization.
- `src/features/operations/list.tsx` — filter controls and clearing.
- `src/features/operations/api.ts` — actual driver/pricing requests and response validation.
- `src/features/shipments/api.ts` — active-driver assignment lookup request.

## Regression Gates

All seven repository-defined scripts ran after the focused browser retest and exited with code 0. No gates were weakened.

| Script              | Result                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run api:check` | **PASS** — generated schemas match the approved contract.                         |
| `npm run lint`      | **PASS** — no errors or warnings.                                                 |
| `npm run typecheck` | **PASS** — route type generation and TypeScript checks.                           |
| `npm run test`      | **PASS** — 139/139 tests in 22/22 files.                                          |
| `npm run test:e2e`  | **PASS** — 16/16 Playwright tests.                                                |
| `npm run test:live` | **PASS** — 3/3 live Playwright tests.                                             |
| `npm run build`     | **PASS** — prebuild contract check, compilation, TypeScript and 8/8 static pages. |

## Frontend Source Changes

Changed application paths: **NONE**.

No frontend defect was reproduced, so application source, tests, dependencies, configuration and OpenAPI were left intact. Only focused acceptance evidence/report files and normal generated test/build artifacts were produced or refreshed.

The final hash comparison confirms **167/167 baseline files remain present and identical**, with zero changed or missing files. The contract SHA-256 remains unchanged. See [source-comparison.json](../reports/boolean-filter-retest/source-comparison.json) and [results.json](../reports/boolean-filter-retest/results.json).

## Remaining Documented Gaps

These are carried forward without being treated as failures of this focused retest:

- Per-record lifecycle action discovery remains unavailable; existing controls remain deferred.
- Disposable operational write fixtures, an explicitly authorized safe payment fixture, and live 409/replay acceptance remain outstanding.
- A safe live-browser 429 trigger remains outstanding; this retest did not attempt to exhaust a rate limit.
- Authenticated phone/tablet, axe and Lighthouse/profiling acceptance remain outstanding.
- Frontend Git metadata remains unavailable; source integrity uses hashes instead.

No lifecycle discovery, public order/tracking flow, driver mobile feature, financial write, business record creation or deployment was performed. The previous broader [authenticated acceptance report](AUTHENTICATED-ACCEPTANCE-REPORT.md) remains historical evidence; this report updates only its Boolean-filter blocker.

## Blocker Status

**BOOLEAN FILTER INTEGRATION BLOCKER: CLOSED**

All six formerly affected filter/unfiltered browser scenarios now render correctly using the unchanged canonical query representation.

## Final Result

**FOCUSED ACCEPTANCE PASSED**

The six Boolean/unfiltered scenarios, equivalent active-driver lookup, reports smoke, contract drift check and all required regression gates pass. No new frontend/backend contract defect was reproduced. The remaining documented gaps stay outside this focused decision.
