# PORTA DELIVERY

# ADMIN DASHBOARD OPERATIONAL ACCEPTANCE REPORT

13 September 2026 · **Operational checks, supported cleanup, both focused frontend fixes and final regression gates are complete.**

The current operational acceptance result is **ADMIN DASHBOARD OPERATIONAL ACCEPTANCE NOT PASSED**. Trip creation and editing reproducibly shift the entered Libya-local times by two hours, and the QA shipment attachment remains rejected with an unresolved conflict. These are operational failures; the result is not caused by missing permissions, a payment fixture or the separate environment limitations. The demonstrated frontend conflict-message and pricing-editor selection defects are fixed with focused regression coverage. All eight QA records are retained in documented final states, including five safely deactivated catalog/pricing records.

## Environment

| Item                                  | Value                                                              |
| ------------------------------------- | ------------------------------------------------------------------ |
| Frontend                              | `http://localhost:3000`                                            |
| Backend API                           | `http://localhost:8080`                                            |
| Backend revision supplied by the user | `02770a1bf7633203b928cfe48948962c9597019c`                         |
| OpenAPI                               | `contracts/porta-api-v1.openapi.json`                              |
| Approved contract SHA-256             | `90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4` |
| Workspace                             | `D:\customers\porta frontend`                                      |

The documented API does not independently expose the running backend commit. The supplied revision is recorded as the integration target. No backend repository, database or internal filesystem was accessed. The contract was not modified or regenerated; its hash is unchanged and the final drift check passed.

The frontend is still not a Git repository. Git was not initialized. The existing [168-file SHA-256 baseline](../reports/operational-acceptance/baseline.json), captured before writes and the demonstrated frontend fixes, replaces unavailable branch/HEAD metadata. Final comparison found exactly the four intentional application/test changes listed below, 164 unchanged baseline files and zero missing files.

The [pre-write disposable-data plan](OPERATIONAL-ACCEPTANCE-TEST-DATA-PLAN.md), [workflow evidence](../reports/operational-acceptance/workflows.json), [findings](OPERATIONAL-ACCEPTANCE-FINDINGS.md), [regression results](../reports/operational-acceptance/regression-results.json) and [source comparison](../reports/operational-acceptance/source-comparison.json) provide the detailed record, including failed attempts and verification limits.

### Evidence limits

Live findings were observed in the existing authenticated browser, through rendered controls, returned resource views and safe support IDs. The available browser interface did not capture raw authenticated HTTP request/response traces. Status-specific validation/conflict wording is mapped through the existing frontend error code; it is not an independently captured wire status. Actual Idempotency-Key bytes and raw timestamp payloads were not captured. Successful UI rendering establishes an accepted response and displayed state, not a separately verified exact HTTP status or request body.

No credentials, authentication cookies or private session storage were exported, copied or saved. Direct authenticated response inspection was unavailable through the supported browser interface; no workaround bypassed that restriction.

## Authentication

**PASS.** The existing authenticated local staff session was reused. Authorized create/edit controls and protected resource views were used without a new login or credential collection. Permissions were checked through the available controls before each workflow; no guard was bypassed.

Fresh direct visits to users and audit routes both displayed the permission-denied guard. No backend read was forced past those guards. The existing session was reused for the final authenticated reloads; no logout or credential transfer was performed for acceptance.

## Disposable Test Data

Unique prefix: **`PORTA-QA-20260913-1715`**. Eight disposable entities were successfully created. Names, codes, contact information and addresses were synthetic. Trips and pricing rules have no documented identifying text field, so their QA city/type/driver relationships identify them together with the observed identifiers.

| Entity        | Identifier / distinguishing data                                                                                                   | Final observed state                                                                                                    | Cleanup result                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| City A        | `01m2dw63kc994q8ysh8tgq16ac`; code `QA0913A1715`                                                                                   | Inactive; English name retains `-EDIT` suffix                                                                           | Retained, deactivation verified                                                 |
| City B        | `01m2dw74z270ck5fxhnj9rdjm1`; code `QA0913B1715`                                                                                   | Inactive                                                                                                                | Retained, deactivation verified                                                 |
| Branch A      | `01m2dw8zjbr2r5g052wc43ax60`; QA City A                                                                                            | Inactive; synthetic address retains `EDIT`                                                                              | Retained, deactivation verified                                                 |
| Shipment type | `01m2dwa7mad0dnxcb6swgzype0`; code `QA0913T1715`                                                                                   | Inactive; edited description retained                                                                                   | Retained, deactivation verified                                                 |
| Driver        | `01m2dwbywn3hzh7wpftdvg5h0k`; QA name/license                                                                                      | Active and assigned to QA shipment; trip reference cleared                                                              | Retained active because shipment assignment has no supported unassign operation |
| Pricing rule  | QA City A → QA City B; type `01m2dwa7mad0dnxcb6swgzype0`; SMALL; effective from `2026-09-13T00:00` Libya time; rule ID unavailable | One inactive rule; base `1.235` LYD / `1235` millimes; door amount `0.100` LYD / `100` millimes                         | Retained; absent from `active=true`, exactly one rule in `active=false`         |
| Shipment      | `01m2dwmhj3j3qgvga408yc7z58`; tracking `PTA-260913-894B6DA768A453B6`                                                               | RECEIVED; no trip; QA driver assigned; amount `1235` millimes; payment PENDING; same QA contacts and edited note        | Retained historical QA record; final reload verified                            |
| Trip          | `01m2dwqsp1angqezd73gaagytt`; QA route                                                                                             | SCHEDULED; zero members; `driver_id:null`, `branch_id:null`; displayed schedule `2026-09-14 12:00` / `15:00` Libya time | Retained scheduled; safe cancellation unavailable in existing UI                |

Branch/type identifiers were read from real option values in the frontend. The pricing-rule identifier was not captured and is explicitly unknown; no identifier is invented. Synthetic phone normalization was observed for the driver and shipment contacts. The contract defines acceptable Libyan phone formatting but provides no reserved non-routable test-number range.

### Cleanup / final test state

**Supported safe cleanup is complete. All eight records remain: five inactive, one active driver, one RECEIVED shipment and one SCHEDULED trip.** Pricing, both cities, the branch and shipment type were deactivated and their inactive states verified. The trip's ordinary edit cleared `driver_id` and `branch_id`; it retains zero members and the observed `12:00` / `15:00` schedule. This successful relationship edit does not resolve the datetime defect.

No historical entity deletion is documented. Shipment driver assignment has no supported null/unassign operation, so its QA driver was deliberately retained active with the outstanding QA shipment. Trip status/cancellation controls are absent from the existing UI; the identified scheduled QA trip was retained without adding a lifecycle workaround. There was no membership to detach and no unrelated data was changed.

After catalog deactivation, a final shipment reload still showed RECEIVED, no trip, the same driver ID, amount `1235` millimes, PENDING payment state and unchanged synthetic contacts/edited note. Inactive catalog references displayed ULID fallbacks; preservation of historical human-readable catalog names is not claimed.

## City Acceptance

**CITY CREATE: PASS. CITY EDIT: PASS.** Empty required fields produced frontend validation. City A appeared as a single row after creation; City B increased the list to two QA rows. Editing City A's English name updated the displayed resource. The catalog implementation submits changed fields for PATCH, but exact live PATCH bytes were not captured. Both QA cities were safely deactivated and verified inactive during cleanup.

## Branch Acceptance

**BRANCH CREATE: PASS. BRANCH EDIT: PASS.** Branch A used QA City A selected from actual catalog options. Creation refreshed the list. Editing its synthetic address produced the expected updated display. The QA branch was deactivated and its inactive state verified during cleanup.

## Shipment Type Acceptance

**SHIPMENT TYPE CREATE: PASS. SHIPMENT TYPE EDIT: PASS.** The QA type was created with the planned unique code, appeared in the list and accepted a harmless description edit. It was safely deactivated and verified inactive during cleanup.

## Driver Acceptance

**DRIVER CREATE: PASS. DRIVER EDIT: PASS. DRIVER ACTIVE FILTER: PASS. DRIVER INACTIVE FILTER: PASS.**

The invalid phone `000` produced a safe field error and support ID. The unchanged rejected input was deliberately retried once and rejected again. Editing the rejected request allowed correction, after which one QA driver was created and its phone displayed in normalized Libyan form. The license was then edited to use the QA prefix.

While the driver had no assigned work, `active=true` included it and `active=false` excluded it. Deactivation moved it into the inactive list; reactivation restored its active state for the later assignment. It is deliberately retained active because the QA shipment remains assigned and the contract provides no shipment-driver unassignment operation.

## Pricing Acceptance

**PRICING CREATE: PASS. PRICING EDIT: PASS after the F5 fix. PRICING ACTIVE FILTER: PASS. PRICING INACTIVE FILTER: PASS.**

One rule for the exclusively QA route/type was created at `1.234` LYD and edited to `1.235` LYD. The authoritative display showed those exact three-decimal amounts; the corresponding representation is `1234` and `1235` integer millimes. The conversion helper uses exact integer arithmetic; no visible rounding discrepancy occurred. The active filter included the rule. One intentional overlapping create was rejected, and only one rule remained.

**F5 — FRONTEND DEFECT: FIXED. PRICING EDIT AFTER FRESH LOAD: PASS on retest.** Before the fix, fresh navigation to `/pricing?active=true` produced an editor with saved amount/size/state but blank origin, destination and shipment-type selections, although actual QA options were loaded. A separate DOM read confirmed the failure; no incomplete edit was submitted.

The focused fix in `src/features/catalog/actions.tsx` preserves authoritative catalog reference selections during asynchronous option loading. Two new regression cases failed before the fix; the catalog-actions suite then passed **7/7**. A fresh live pricing edit subsequently showed all three correct saved identifiers. Cleanup through that editor successfully set `active:false`: the rule disappeared from the active filter and exactly one matching rule appeared under `active=false`, retaining base `1.235` LYD and door amount `0.100` LYD.

## Quote Acceptance

**QUOTE: PASS** for authoritative display and stale-input handling. The quote showed `1.235` LYD. Clearing shipment size removed the quote and disabled creation; restoring SMALL restored the quote. Incomplete selection did not retain a usable old quote.

Source review confirms the existing 350 ms debounce and cancellation signal path. Actual network cancellation/debounce timing was not captured and is not claimed as separately verified. No authoritative price was calculated in the frontend.

## Shipment Create Acceptance

**SHIPMENT CREATE: PASS.** One disposable shipment was created with QA contacts and catalog references. Its detail rendered with the observed tracking number, authoritative amount `1235` millimes, RECEIVED status and PENDING cash-on-delivery state. Contact phones were normalized by the returned resource. No duplicate shipment was observed from the logical submission.

The unchanged create adapter supplies an Idempotency-Key through the central client, but actual key bytes were not captured. This result does not establish successful backend replay.

## Shipment Edit Acceptance

**SHIPMENT EDIT: PASS.** The documented note field accepted the QA `EDIT` change. Tracking number, authoritative amount and lifecycle status remained unchanged. No immutable identity, route, pricing or status value was locally overwritten.

## Driver Assignment Acceptance

**DRIVER ASSIGNMENT: PASS.** The active-driver lookup returned the disposable driver. Assignment through the documented UI succeeded, and the shipment view reflected driver `01m2dwbywn3hzh7wpftdvg5h0k`. No unrelated driver was used and no local eligibility rule replaced the backend decision.

## Trip Acceptance

**TRIP CREATE: FAIL. TRIP EDIT: FAIL.** Resource creation succeeded, but schedule correctness failed on both operations.

| Operation       | Entered Libya-local departure / arrival                                             | Observed departure / arrival                  |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Create          | `2026-09-14T10:00` / `2026-09-14T12:00`                                             | `12:00` / `14:00` in detail and reopened edit |
| Controlled edit | `2026-09-14T10:00` / `2026-09-14T13:00`, DOM-verified immediately before submission | `12:00` / `15:00` in detail                   |

**F1 — BACKEND IMPLEMENTATION DEFECT (inferred attribution).** The two-hour round-trip error is reproduced. Independent execution of the actual frontend conversion produced `2026-09-14T10:00:00+02:00` for the `10:00` input, equivalent to `08:00Z`, and both edit/default conversion and display returned `10:00`. Generated validators do not transform timestamps and the client JSON serializer preserves those strings. One focused existing offset/preservation test passed; eight unrelated tests were skipped in that diagnostic run.

Raw authenticated outgoing/returned timestamps were unavailable, so the precise backend storage or serialization cause is not proven. No speculative two-hour frontend compensation was added. A later cleanup edit successfully cleared driver and branch references; the trip remains scheduled with zero attached shipments and the shifted display times.

## Trip Attach/Detach Acceptance

**TRIP SHIPMENT ATTACH: FAIL. TRIP SHIPMENT DETACH: NOT APPLICABLE.**

The single QA shipment was submitted through the existing attachment UI. Conflict feedback appeared with support ID `c7d81d01-00dc-4bbf-ab23-8d34dc5d39e2`, and membership remained zero. The shipment was RECEIVED, on the same QA route, assigned to the same QA driver, not delivered and not attached to another trip. The trip was SCHEDULED. The available contract does not document an additional PREPARING prerequisite, and no hidden eligibility rule was inferred or bypassed.

**F3 — BACKEND CONTRACT GAP: unresolved conflict reason/eligibility.** The attempted supported workflow remains rejected; exact raw status and the specific conflict reason were not captured. There is no membership to detach, so a detach operation was not sent.

**F4 — DEFERRED FEATURE:** selection uses identifiers copied from actual shipment detail URLs. A server-backed searchable selection control is absent; that checklist item could not be verified. Membership display is paginated. No new picker was introduced in this acceptance task.

## Idempotency

The existing controlled retry of identical rejected driver input was exercised. Both attempts showed field validation feedback with distinct support IDs, and correction subsequently produced one driver. This verifies the exposed retry/recovery interaction.

**Successful same-key backend replay: NOT TESTED — HARNESS REQUIRED.** Actual key values and a successful replay response were not captured. Source inspection confirms one key/body per logical attempt and no automatic mutation retry; it does not substitute for live wire evidence. The helper returns its settled promise after success rather than intentionally issuing a second successful request.

**Different-payload same-key conflict: NOT TESTED — HARNESS REQUIRED.** The current UI does not safely expose a way to alter a committed payload under the same key. No invasive harness or backend storage manipulation was introduced.

## Live 409 UX

**PASS for observed pricing conflict feedback and rejection; exact HTTP status not independently captured.** An overlapping QA pricing create produced clear Arabic conflict feedback, preserved context and displayed support ID `9978a909-4878-4881-a0b1-ce1f42d9a83a`. One rule remained, without observed overwrite or automatic retry. The conflict class is source-mapped; it is not a raw network trace.

The rejected trip attachment exposed **F2 — FRONTEND DEFECT**, misleading generic conflict wording that claimed another user changed the data and that a refresh completed. Neither claim follows from a conflict alone. **F2 is fixed** in `src/features/operations/editor.tsx`: the message now neutrally requests review of current data and preserves the support ID. Focused regression coverage in `tests/unit/operation-writes.test.tsx` passes **10/10**. The revised copy was unit-verified; no new live conflict request was sent solely to retest wording. This fixes feedback accuracy, not the underlying trip attachment rejection. Final regression results are below.

## Live 422 UX

**PASS for observed field validation, safe-input preservation and correction; exact HTTP status not independently captured.** Invalid QA driver phone `000` was rejected with a mapped field error. Initial support ID: `68b22efa-e206-4369-a3b4-7f3120423e17`. Controlled identical rejected retry: `d2a4e3a5-b0e8-4f14-a5e4-0602fa2c09c0`. The form retained safe input, exposed no raw backend internals, and allowed editing the rejected request before successful correction.

The status-specific frontend mapping supports the validation classification; a literal HTTP 422 was not captured and is not claimed as wire-verified evidence. Empty city fields also exercised local required-field validation, which is separate from backend validation.

## Retry-After / 429

**NOT TESTED — SAFE 429 TRIGGER REQUIRED.** No approved safe live trigger was available. No throttle settings were changed and no rate limit was exhausted. Previously verified CORS exposure and existing retry-policy coverage are not relabelled as a live 429 result for this task.

## Payment Read

**PAYMENT READ: PASS.** The disposable shipment's empty ledger rendered correctly. No populated safe ledger fixture was available, so immutable populated rows, methods and refund display were not exercised here.

## Payment Write

**NOT TESTED — SAFE PAYMENT FIXTURE REQUIRED.** No dedicated payment fixture was approved for financial acceptance. No payment, capture, confirmation or refund transaction was created merely to satisfy the checklist. The shipment's initial PENDING payment state is not payment-write acceptance.

## Users / Audit

**USERS: NOT AUTHORIZED. AUDIT: NOT AUTHORIZED. AUDIT ACCEPTANCE: NOT AUTHORIZED.** Fresh visits to the actual frontend routes displayed the permission-denied guard. No staff account creation, permission expansion, backend read bypass or audit claim was made. These are correct permission-dependent limits, not acceptance failures.

## Lifecycle Integration

**LIFECYCLE UI: DEFERRED PENDING BACKEND CONTRACT EXTENSION**

Per-record allowed shipment transitions remain absent from the approved contract. Direct lifecycle controls remain unavailable. No status graph was hardcoded, no invalid transition was submitted to discover behavior, and no lifecycle mutation was used to bypass the attachment rejection. Existing trip status controls are also unavailable in the current UI; this limits final cleanup rather than authorizing a new control.

## Responsive

Authenticated dashboard, reports, shipments, shipment detail, trips and pricing: **PASS for the observed desktop layout at width 1052 px**. RTL was retained and document width was at most 1052 px on the tested screens. Screenshots showed long QA labels with table scrolling contained within its own horizontal scrollbar rather than expanding the document. Dashboard/reports displayed one shipment, one active trip and zero revenue. These observations do not establish responsive behavior at another viewport width.

Authenticated phone/tablet checks: **BLOCKED — ENVIRONMENT.** Viewport override attempts requested `390×844` and `768×1024`; both retained the actual `1052×912` viewport. The override was reset. Those attempts therefore do not establish phone/tablet rendering, overflow, touch-target or table acceptance. No authentication cookies were exported to a different automation profile.

## Accessibility

**PASS for the observed trip edit dialog keyboard/focus sequence.** A click opened the dialog with initial focus on its close control. Shift+Tab moved to Save; Tab returned to Close. Escape dismissed the dialog and focus returned to its trigger. Keyboard activation of the trigger with Enter was not tested. This verifies the observed traversal and focus return only.

Authenticated axe execution: **BLOCKED — ENVIRONMENT.** The current authenticated browser profile was not available to the supported axe automation without unsupported credential/profile transfer. No cookies were exported. No authenticated reduced-motion or screen-reader pass is claimed. Broader keyboard/accessibility coverage remains limited to evidence actually observed; prior unauthenticated gates are not presented as authenticated results.

## Performance

Authenticated connected-page Lighthouse/profiling: **BLOCKED — ENVIRONMENT.** The current authenticated profile cannot be supplied to that automation through the available supported tooling. No authentication storage was copied. No new authenticated LCP, CLS, blocking-time or JS-footprint measurement is claimed, and historical foundation measurements are not relabelled. No production SLA is asserted.

## Regression Gates

All seven final repository scripts completed with exit code 0. The unit gate needed a process-local worker limit; its earlier timeouts are preserved rather than discarded.

| Gate                | Final result                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `npm run api:check` | **PASS** — generated schemas match the unchanged contract.                                 |
| `npm run lint`      | **PASS** — no lint errors.                                                                 |
| `npm run typecheck` | **PASS** — generated route types and TypeScript.                                           |
| `npm run test`      | **PASS** — 142/142 tests, 22/22 files, 38.14 s, with process-local `VITEST_MAX_WORKERS=1`. |
| `npm run test:e2e`  | **PASS** — 16/16, 40.6 s.                                                                  |
| `npm run test:live` | **PASS** — 3/3, 3.4 s.                                                                     |
| `npm run build`     | **PASS** — compilation, TypeScript, 8/8 static pages and prebuild contract check.          |

Before the final source change, one full unit attempt timed out with 139/140 passing, then the unchanged serial command passed 140/140. After F5, the default-worker run timed out with 141/142 passing in the other permission variant of the existing quote/create test. Both variants passed in an isolated diagnostic. One final full run using the installed runner's documented worker-limit environment variable passed all 142 tests. The environment was restored; test selection, file isolation, assertions and 5000 ms timeouts were unchanged. Default-worker timing sensitivity remains an **ENVIRONMENT GAP**, not a claimed fix to the quote workflow.

The focused F2 suite passed **10/10** and F5 passed **7/7**, after two new cases first reproduced the defect. The separate datetime diagnostic passed its one selected test. No gate was weakened. Foundation E2E and public/unauthenticated live regression tests are distinguished from the authenticated operational browser observations in this report.

## Frontend Source Changes

The completed intentional application/test changes currently reported for this acceptance task are:

- `src/features/operations/editor.tsx` — replace the reproduced misleading conflict claims with neutral Arabic review guidance; retain the support ID.
- `tests/unit/operation-writes.test.tsx` — regression coverage for accurate conflict guidance and support-ID display.
- `src/features/catalog/actions.tsx` — preserve saved catalog references when asynchronous edit options become available.
- `tests/unit/catalog-actions.test.tsx` — two regression cases for preserved catalog reference selections.

No request payload, datetime offset conversion, retry policy, OpenAPI, dependency, backend code or business rule was changed for F2. Acceptance reports/evidence and normal generated test/build artifacts are separate from these application changes.

F5 remediation is complete with focused regression coverage and a fresh live editor/cleanup retest. Final comparison against the 168-file baseline confirms **four expected changed files, 164 unchanged files, zero missing files**, plus the three new acceptance Markdown documents and report evidence. The approved contract hash is unchanged.

## Remaining Gaps

| Classification                                      | Remaining issue                                                                     | Effect                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| BACKEND IMPLEMENTATION DEFECT, inferred attribution | Reproduced trip create/edit two-hour round-trip shift                               | Operational acceptance fails; exact backend cause still unproven.         |
| BACKEND CONTRACT GAP                                | QA trip attachment rejected; conflict reason/eligibility unresolved                 | Attach fails and detach cannot be exercised.                              |
| DEFERRED FEATURE                                    | Manual-ID-only shipment attachment selection                                        | Server-backed search/pagination selection is absent.                      |
| ENVIRONMENT GAP                                     | No captured successful same-key replay/key bytes; no safe differing-payload harness | Backend replay and key-mismatch coverage remain unverified.               |
| TEST DATA GAP                                       | No dedicated safe payment fixture                                                   | Payment writes intentionally not tested.                                  |
| ENVIRONMENT GAP                                     | No approved safe live 429 trigger                                                   | No live browser Retry-After timing claim.                                 |
| ENVIRONMENT GAP                                     | Authenticated viewport resizing, axe and Lighthouse unavailable                     | Phone/tablet and automated authenticated a11y/performance remain blocked. |
| BACKEND CONTRACT GAP / DEFERRED FEATURE             | Allowed lifecycle action discovery absent                                           | Shipment lifecycle UI remains deferred.                                   |
| ENVIRONMENT GAP                                     | Frontend Git metadata unavailable                                                   | SHA-256 baseline/comparison used instead.                                 |

Supported safe cleanup, both frontend fixes and final regression/source checks are complete. Default-worker unit-test timing sensitivity is preserved in the regression evidence. Users/audit are confirmed not authorized. None of these results resolves the reproduced trip operational failures.

## New Findings

| Finding                                                                     | Classification                                      | State                                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| F1: Trip entered times return/display two hours later                       | BACKEND IMPLEMENTATION DEFECT, inferred attribution | OPEN; reproduced create and edit; frontend conversion independently verified.                                                    |
| F2: Generic conflict feedback claimed another editor and successful refresh | FRONTEND DEFECT                                     | FIXED; two scoped source/test changes; 10 focused tests pass.                                                                    |
| F3: Compatible-looking disposable shipment attach rejected                  | BACKEND CONTRACT GAP, reason/eligibility unresolved | OPEN; zero membership; no lifecycle bypass.                                                                                      |
| F4: Attachment selection has no server-backed search                        | DEFERRED FEATURE                                    | Recorded; no feature expansion in acceptance.                                                                                    |
| F5: Fresh-load pricing editor blanks saved catalog selections               | FRONTEND DEFECT                                     | FIXED; two regression cases reproduced failure before repair, 7 focused tests pass, fresh live editor and deactivation verified. |

## Final Result

**ADMIN DASHBOARD OPERATIONAL ACCEPTANCE NOT PASSED**

Safe cleanup is complete, both demonstrated frontend defects are fixed, and all final gates pass with the documented unit-worker limit. Trip create/edit schedule correctness and the supported attachment workflow remain unresolved failures. The passing workflows and explicit fixture/environment limits do not override these operational failures. No backend/OpenAPI change, financial mutation, lifecycle implementation or deployment was performed.
