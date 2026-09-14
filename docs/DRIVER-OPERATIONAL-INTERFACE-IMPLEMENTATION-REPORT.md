# PORTA DELIVERY

# DRIVER OPERATIONAL INTERFACE IMPLEMENTATION REPORT

Acceptance date: 14 September 2026, Africa/Tripoli. Scope: the independent Next.js frontend at `D:\customers\porta frontend`.

## Baseline

| Item                                              | Verified value                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Starting frontend branch                          | `main`, clean before implementation                                |
| Starting frontend / unchanged main SHA            | `16cdedd53e21645660bb48e7c6050bde25f53917`                         |
| Backend integration revision supplied by the user | `064f2903b7f612ff486428d00039387538a040e9`                         |
| Feature branch                                    | `feat/driver-interface`                                            |
| Approved API origin                               | `http://localhost:8080`, from existing `NEXT_PUBLIC_API_BASE_URL`  |
| Local contract                                    | `contracts/porta-api-v1.openapi.json`                              |
| OpenAPI SHA-256                                   | `2b025d1d9c33407920869eea6a0cf5bf5cc6971643b28e6e0c36f54a682ae658` |
| Contract drift                                    | PASS: generated schemas match the approved local contract          |
| OpenAPI/generated artifact changes                | None; no regeneration or manual schema edits                       |

The backend revision is user-supplied context, not a claim of repository inspection. No backend repository, database, migration, or PHP source was accessed. No merge, push, tag, or deployment was performed.

## Driver API Operations Used

All requests pass through the existing centralized API client and generated operation/schema definitions. No fallback Admin endpoint is used.

| Operation ID                        | Method and exact path                             | Use                                                                  |
| ----------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `getDriverTrips`                    | GET `/api/v1/driver/trips`                        | Driver-scope acceptance probe and cursor-paginated trips             |
| `getDriverTripsTrip`                | GET `/api/v1/driver/trips/{trip}`                 | Assigned trip detail                                                 |
| `getDriverShipments`                | GET `/api/v1/driver/shipments`                    | Cursor-paginated assigned shipments; optional status and trip filter |
| `getDriverShipmentsShipment`        | GET `/api/v1/driver/shipments/{shipment}`         | Driver-safe shipment detail                                          |
| `postDriverShipmentsShipmentStatus` | POST `/api/v1/driver/shipments/{shipment}/status` | The two explicitly documented shipment actions                       |

Shared authentication uses `getCsrfCookie` (GET `/sanctum/csrf-cookie`), `postAuthLogin` (POST `/api/v1/auth/login`), `getAuthMe` (GET `/api/v1/auth/me`), and `postAuthLogout` (POST `/api/v1/auth/logout`).

## Public / Admin Isolation

Driver routes have their own route group, layout, navigation, API module, response types, and `driver-workspace` query-key namespace. They reuse authentication, the API client, formatting, and design tokens. They do not import Admin presentation, tables, reports, pricing editors, audit UI, the public booking form, or tracking presentation. The production bundle audit checks all six driver pages and comparison Admin/public manifests.

No Admin or public feature implementation was changed. The three shared authentication changes are listed under Source Changes. Public pages remain anonymous. Synthetic browser fixtures reject unexpected API calls and all unintended external traffic.

## Authentication

The existing Sanctum first-party cookie session, CSRF bootstrap, validated `/auth/me`, login, and logout are reused. There is no new bearer token or credential storage model. Operational data stays in TanStack Query memory and the existing private-cache clearing boundary applies on session end.

Login defaults to `/driver` for a validated DRIVER identity when no explicit safe return path was supplied. Staff default navigation remains unchanged. Driver login return parameters retain only bounded page size, status, and a valid trip identifier; contact/address values, opaque cursors, and fragments are discarded.

## Driver Authorization Model

The guard first requires the validated authenticated identity to have role DRIVER, then requires a successful dedicated driver-trips request. The contract makes that request contingent on an active user linked to an active driver profile. Role text alone never renders the operational workspace. Non-driver staff receive a safe unavailable-account screen and make no driver-scoped request.

Read endpoints do not declare separate `trips.view` or `shipments.view` permissions, so none are invented. The status action requires the actual returned `shipments.change_status` permission, obtained from the generated operation metadata. The server remains responsible for ownership, active-profile checks, transition validity, and final authorization. The `Me` contract exposes no driver-profile identifier, linkage, active/availability field, or editing capability; none is inferred or displayed.

## Routes Added

- `/driver`
- `/driver/trips`
- `/driver/trips/[id]`
- `/driver/shipments`
- `/driver/shipments/[id]`
- `/driver/account`

The route layout and shell are Server Components around narrow client authentication/data/action boundaries. The route group includes loading and error boundaries using the installed Next.js APIs.

## Driver Home

Home shows up to three records from each first server page of 20 under “من رحلاتك” and “من شحناتك”, with links to the full paginated lists. Backend order is preserved. There are no company totals, invented current/next-trip classifications, daily-completion statistics, or client-side scans of all assignments.

## Trips

Cards show returned origin/destination, status, absolute departure time, and optional shipment count. Missing city data is identified honestly; zero count remains zero. Detail adds optional estimated arrival and a shipment list requested through the driver endpoint with `trip_id`. Status and cursor pagination use the generated query schemas. No date/current/upcoming filter is invented.

No driver-scoped trip mutation exists in the approved contract. There are no start/arrive/complete, shipment attach/detach, or Admin mutation controls in this workspace. This is a DRIVER BACKEND CONTRACT GAP, not an emulated frontend workflow.

## Shipments

Lists prioritize tracking number, current status, recipient name, destination, and delivery method. They do not expose contact numbers or addresses. Details render the explicitly permitted `DriverShipment` fields: tracking/status, optional route/type, size, delivery method, textual address, sender and recipient names/phones, and a linked trip when returned.

Phones use guarded `tel:` links that accept plain dialable numbers, normalize Arabic digits and safe separators, and reject URI parameters/control or USSD-style strings. There is no map SDK or location request. Optional fields are omitted when absent. IDs occur only in necessary scoped route/request paths and are not displayed as business labels.

## Driver Actions

The approved operation description explicitly documents only:

| Returned current status | Permitted target   |
| ----------------------- | ------------------ |
| `ARRIVED_CITY`          | `READY_FOR_PICKUP` |
| `READY_FOR_PICKUP`      | `DELIVERED`        |

These exact edges are centralized with Arabic labels; no general lifecycle is reconstructed from the status enum. No action is offered for another status or without permission. The strict request body contains only the target status. Confirmation displays the current state, requested action, and a clear Arabic condition. The confirm button prevents duplicates and remains pending until a response; success uses the validated authoritative response, including matching resource ID and target status.

The existing idempotency helper holds one immutable body/key for an uncertain network, 5xx, or 429 outcome. A retry requires an explicit click and reuses that attempt. A new deliberate operation receives a new key. There is no automatic mutation retry, offline queue, optimistic status claim, or persistence of an unfinished operation across session end.

## Privacy

Strict driver response schemas reject unexpected private/Admin fields. Detail IDs and filtered responses are also checked against the request. Rendering is an explicit field allowlist. Tests inject financial/notes/identity extras and prove they never render; card tests also prove contact/address values are excluded.

No operational contacts are logged, persisted, or sent to analytics. Query data is in memory only. A 403/404 discards denied detail data so subsequent network/503 failures cannot resurrect it. Known denied resources are removed from cached list copies while other assigned rows remain available; cancelling a pending list read preserves its prior successful state. Successful fresh reads can restore access. Late writes and revocation work cannot repopulate an ended session's cache.

## Timezone

Absolute API timestamps use the existing `Africa/Tripoli` formatter, with semantic `<time datetime>` values. There is no manually added UTC offset or invented ETA. Unit and browser checks cover the formatter and known fixture instants.

## Error Handling

| Condition                 | Behavior                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 401                       | Clear private content and use the shared session-expiry redirect with a safe return path                                      |
| 403 / 404                 | Neutral unavailable-work feedback; no fallback endpoint or enumeration; revoke cached detail and known list copies            |
| 409                       | “تم تحديث البيانات. يرجى مراجعة الحالة الحالية.”; require an authoritative detail read before another action                  |
| 422                       | Safe Arabic validation/domain feedback; no raw backend text; require a new deliberate confirmation                            |
| 429                       | Display Retry-After guidance and block premature requests; shared read cooldown survives filter changes and ordinary cache GC |
| 500 / 503                 | Safe service feedback; retain prior successful read as possibly stale; uncertain writes retain their original attempt         |
| Network                   | Safe connection guidance, retained successful reads, and explicit retry; no claim of offline synchronization                  |
| Invalid contract response | Safe failure without rendering the unapproved response                                                                        |

Concurrent read-rate limits retain the longest deadline. Conflict recovery uses the same read policy, including 429 handling. Cooldown expiry does not trigger a request. Queries have no polling, focus/reconnect refresh, or automatic retry; navigation may fetch stale data, and operational pages expose manual refresh.

## Session Expiry

The guard renders no driver content during identity/scope checks. Session expiry clears private cache, unmounts scope observers, and redirects safely without loops. Account shows only validated name/email and secure logout. Logout and re-login tests prove that previous work is not inherited by a subsequent session; late action completions are ignored after unmount.

## Mobile / Responsive

The existing Porta design system is extended with a compact header and four labeled destinations. Phones use one column and bottom navigation with safe-area space. At 768px, navigation becomes a top row and lists can use two columns. Primary controls meet 48px; secondary targets meet 44px. Native filter text is at least 16px.

Evidence includes 43 full-page state/viewport captures plus six actual scrolled mobile action viewports: all eight required states at 390/430/768/1440, home and both details at 1024, and all eight states in dark mode at 390. No overflow or undersized target was detected. Full-page fixed-navigation stitching limitations are documented; the six action viewports separately show unobstructed controls.

## Accessibility

All 43 visual axe checks reported zero violations for the configured WCAG 2 A/AA and WCAG 2.1 AA tags. Driver E2E additionally checks both themes, keyboard confirmation/cancel focus, landmarks/navigation, and delayed/pending feedback. Status meaning does not rely on color. Existing global focus and theme styles are retained; reduced motion is respected.

The single mechanical design scan returned no findings. An independent finish reviewer opened all 49 PNGs and returned **ship**, with no material visual fixes. Account was reviewed in source; loading/pending/focus behavior is covered separately by source/tests rather than those stills. Physical devices and manual screen-reader operation were not tested. Automated axe results are not a claim of complete accessibility conformance.

## Performance

Lighthouse measured the completed production build `JmagTaEA0VOTT2vXolXag` served by `next start` on localhost:3001. Authenticated identity and assigned work were intercepted synthetic responses; measurements exclude real API latency and field INP. Every accepted result verified loaded work, scoped API requests, no unexpected/Admin/public request, and no development runtime.

| Page / profile        | Performance | Accessibility / best practices | LCP      | CLS | TBT    | JS transfer   |
| --------------------- | ----------- | ------------------------------ | -------- | --- | ------ | ------------- |
| Home / mobile         | 81          | 100 / 100                      | 3,770 ms | 0   | 343 ms | 318,218 bytes |
| Trip detail / mobile  | 82          | 100 / 100                      | 4,007 ms | 0   | 282 ms | 323,980 bytes |
| Home / desktop        | 100         | 100 / 100                      | 805 ms   | 0   | 1 ms   | 318,218 bytes |
| Trip detail / desktop | 99          | 100 / 100                      | 857 ms   | 0   | 0 ms   | 323,980 bytes |

Mobile cold-load performance remains an improvement opportunity: the measured main content takes approximately 3.8–4.0 seconds under Lighthouse mobile throttling. These figures are reported without claiming a field SLA or concealing them behind the desktop scores. No numeric performance pass threshold was supplied by this phase.

The initial desktop-trip measurement's final Lighthouse screenshot contained loaded work, but a later BFCache audit navigated away/back and the harness checked that page before rehydration completed. The harness now waits for final content outside the measured trace. Only that same-build desktop pair was rerun; the other three valid measurements were preserved. Original metrics/failure details and the focused rerun are retained in `performance/results.json` and the two performance gate logs. The final summary is **MEASURED**, with no measurement/isolation failures. Raw Lighthouse HTML/JSON files remain local and ignored; compact summaries and relevant verification images are retained.

## Bundle Isolation

All six production driver manifests passed the source/signature audit. Route-entry client chunks are approximately 566,664–581,664 decoded bytes and 145,172–150,225 independently gzip-compressed bytes, excluding common framework runtime. Home is 577,630 / 148,946 bytes; trip detail is 579,861 / 149,609 bytes. These are build estimates, not total navigation transfer or per-feature exclusive bytes. Shared authentication, generated validation, and permissions are intentionally included.

Admin/public comparison manifests contain no driver presentation. Driver manifests contain no Admin/public presentation or table signatures. Detailed source/chunk lists are in `reports/driver-interface/performance/bundle-isolation.json`.

## Live Driver Acceptance

**Read-only:** the new live test verifies a fresh anonymous browser against the actual API: `/auth/me` returns 401, driver data is not requested/rendered, and login receives the safe intended path. Its allowlist permits only GET `/api/v1/auth/me`; no existing staff session is imported. Development StrictMode across driver/login mounts produces four bounded session checks.

**Authenticated read-only driver acceptance: NOT TESTED — SAFE DISPOSABLE DRIVER ACCOUNT REQUIRED.** The user explicitly confirmed that no driver fixture is available. Identity/profile scoping, assigned live trips/shipments, and live cross-driver denial are therefore not claimed as verified. Those frontend paths are covered by deterministic contract fixtures.

**Mutation: NOT TESTED — SAFE DRIVER MUTATION FIXTURE REQUIRED.** No real driver status, trip, shipment membership, or assignment was changed. Both supported status actions and their error/retry paths pass intercepted tests. Synthetic measurements do not certify a real backend mutation.

## Cross-Driver Isolation

Deterministic trip and shipment fixtures return 404 for a known foreign resource. The UI shows safe unavailable feedback, makes no Admin fallback, and does not enumerate another identifier. Strict schemas and requested-ID checks prevent accidental substitution. The backend contract defines ownership enforcement; independent live ownership proof remains a test-data gap. No unrelated real driver was queried.

## Testing

The final unit run passed **309/309 tests in 36 files**. The driver-focused run passed **105/105 in five files**: query parsing, strict driver schemas/ID/filter validation, status/phone mapping, role plus scope guard, session clearing, privacy, cached-read revocation, long/concurrent cooldowns, confirmation/pending, idempotency, 409/422/429, and late-write/logout races. One additional shared-auth test covers safe driver return filters.

The final Playwright run passed **75/75**: 33 driver, 13 public-order, 13 public-tracking, and 16 existing foundation/Admin shell scenarios. The full live suite passed **6/6**, including the anonymous driver guard and existing read-only HTTP/public regressions. No authenticated driver live test or driver write is included in that live count.

Initial failures are retained in the gate directory. Parallel E2E/live runs initially collided in Playwright's common artifact directory (missing trace files); the final runs were separated. The initial anonymous-driver harness allowed three session reads, while two StrictMode mount cycles legitimately issued four; the strict allowlist now permits at most four GET `/auth/me` calls and records sanitized failure reasons. Default unit-worker allocation caused existing five-second Admin tests to time out; two-worker execution passed every test, and that worker bound is now the runner default. Test timeouts, assertions, retries, and application logic were not relaxed to make these gates pass.

## Public Order Regression

Existing public-order unit, browser, and read-only catalog tests remain part of the full gates. Booking logic was not modified. The browser suite includes review/confirmation, immutable retry, validation, pricing reset, keyboard/mobile/theme behavior, and order-to-tracking navigation. No new live order was created for this phase.

## Public Tracking Regression

Existing tracking tests cover anonymous lookup, safe schema rendering, copy, direct links, manual refresh, 429, cancellation, and privacy. The live gate reads the existing disposable QA order and deliberately refreshes it without creating or changing a shipment. Fresh regression evidence is retained under this phase; the historical acceptance artifact is preserved.

## Admin Regression

Existing Admin/auth, catalogs, shipment/trip/pricing/user/payment, and shell tests are included. No Admin application logic or styling was changed. Shared authentication keeps staff default routing and exact permission behavior. Test-runner worker allocation was bounded as described below; no assertions or timeouts were weakened.

## Quality Gates

| Command / check           | Final result                                  | Evidence                                                    |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `npm run api:check`       | PASS; no drift                                | `gates/api-check.txt`                                       |
| `npm run lint`            | PASS                                          | `gates/lint.txt`                                            |
| `npm run typecheck`       | PASS                                          | `gates/typecheck.txt`                                       |
| `npm run test`            | PASS, 309/309                                 | `gates/unit.txt`                                            |
| `npm run test:e2e`        | PASS, 75/75                                   | `gates/e2e.txt`                                             |
| `npm run test:live`       | PASS, 6/6; read-only scope described above    | `gates/live.txt`                                            |
| `npm run build`           | PASS, all six driver routes emitted           | `gates/build.txt`                                           |
| `npm run test -- driver-` | PASS, 105/105                                 | `gates/driver-focused.txt`                                  |
| Visual / axe              | PASS, 43 measured states and 49 reviewed PNGs | `visual/results.json`, `visual/FINISH-REVIEW.md`            |
| Production bundle audit   | PASS, all six driver routes isolated          | `performance/bundle-isolation.json`                         |
| Production Lighthouse     | MEASURED, four valid same-build results       | `performance/results.json`, `gates/performance-focused.txt` |

Evidence paths in this table are relative to `reports/driver-interface/`. Production performance measurements are reported separately above; no Lighthouse score or field SLA is implied by the application/test gate results.

## Source Changes

**New driver application files (28):**

- `src/app/(driver)/layout.tsx`; `driver/page.tsx`, `driver/loading.tsx`, `driver/error.tsx`, `driver/account/page.tsx`, `driver/trips/page.tsx`, `driver/trips/[id]/page.tsx`, `driver/shipments/page.tsx`, and `driver/shipments/[id]/page.tsx` beneath that route group.
- `src/features/driver-workspace/`: `account.tsx`, `actions.tsx`, `api.ts`, `cards.tsx`, `driver-workspace.css`, `home.tsx`, `model.ts`, `session.tsx`, `shell-navigation.tsx`, `shell.css`, `shell.tsx`, `shipment-detail.tsx`, `shipment-list.tsx`, `states.tsx`, `status.ts`, `trip-detail.tsx`, `trip-list.tsx`, `ui.tsx`, `use-driver-read.ts`.

**Shared reusable application changes (3):**

- `src/lib/auth/contracts.ts`: retain validated role with name/email/permissions in the existing session projection; identifiers remain omitted.
- `src/features/auth/login-form.tsx`: DRIVER default login destination; preserve safe explicit return path and staff behavior.
- `src/lib/auth/redirect.ts`: allowlist non-sensitive driver return filters and strip other query/fragment data.

**Tests and tools:** five new driver unit files (`driver-api`, `driver-model`, `driver-query`, `driver-session`, `driver-ui-actions`); a driver E2E file; a read-only live guard file; one shared auth expectation update and return-path test; the driver Playwright project; four synthetic fixture/visual/performance/bundle scripts; ignored raw Lighthouse reports. `vitest.config.ts` bounds jsdom workers to two after measured default-worker timeout failures, preserving all existing assertions, isolation, and five-second test limits. No dependency/package/lockfile change is needed.

**Documentation/evidence:** this report, the scoped driver design note/surface brief, and `reports/driver-interface/` containing gate logs, captured synthetic screenshots and measurements, review records, sanitized live evidence, and production summaries. Exact tracked paths are exported in `reports/driver-interface/source-changes.json` and the final external source-state record.

## Commits

| Commit                                      | Scope                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `b508bc473f6148d6ca0b9200f2b0baed9b76daae`  | `feat(driver): add scoped operational workspace and safe actions`      |
| `570d312e60740044c896ce6239a7f30fc5741de1`  | `test(driver): verify scoped workflows and production acceptance`      |
| `08ade9ff5c4b95b235277de7c42267dd692045c9`  | `test(driver): await post-audit content and preserve measured results` |
| Documentation commit containing this report | `docs(driver): record implementation and acceptance`                   |

The exact final documentation-commit SHA, clean status, branch, unchanged main SHA, last ten available commit entries, and complete baseline-to-final path list are recorded after that commit in [the final source-state record](C:/Users/Mohamed/.codex/visualizations/2026/09/13/01a09a82-f5a8-79a1-aa24-83ca1f166784/porta-driver-interface-final-source-state.json). This external record avoids a self-referential commit hash inside the report. No history was rewritten.

## Remaining Gaps

| Classification              | Bounded gap or deferred work                                                                                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FRONTEND GAP                | No demonstrated supported-flow functional defect remains after the final gates. Mobile lab performance remains an improvement opportunity: scores 81–82, LCP 3.8–4.0s and TBT 282–343ms. Physical-device and manual assistive-technology acceptance remains unperformed, not implied by automated checks.      |
| DRIVER BACKEND CONTRACT GAP | No driver trip mutations; no profile availability/linkage fields; no guaranteed current/next/day aggregates, date filter, or branch detail. No replacement rule, KPI, or Admin fallback is implemented.                                                                                                        |
| TEST DATA GAP               | No approved disposable driver account for authenticated live reads, no safe status-mutation fixture, and no live cross-driver ownership fixture. Deterministic frontend coverage is explicitly separated from backend proof.                                                                                   |
| ENVIRONMENT GAP             | Local production Lighthouse uses synthetic authenticated responses and excludes real API latency/field INP. Initial test-runner artifact collision and resource-contention failures are retained and resolved in the final separated runs. No deployment or production infrastructure verification is claimed. |
| DEFERRED FEATURE            | GPS/maps/location, WebSocket/SSE, background polling, lifecycle discovery, PWA/offline writes, scanner, signature/photo/proof of delivery, account editing, and deployment. None was started.                                                                                                                  |

The completed Admin, public-order, and public-tracking scope is preserved. Driver trip mutations remain unavailable by contract; the two supported shipment actions are implemented and tested without inventing additional transitions.

## Final Result

**DRIVER OPERATIONAL INTERFACE PASSED WITH DOCUMENTED GAPS**

Acceptance is a local frontend implementation verdict with the explicit live-fixture and physical-device limitations above. The feature remains on its clean feature branch. Work stops at this report.
