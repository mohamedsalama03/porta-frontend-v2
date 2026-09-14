# PORTA DELIVERY

# DRIVER TRIP ACTIONS FRONTEND INTEGRATION REPORT

Date: 14 September 2026. Scope: the frontend at `D:\customers\porta frontend` only. Evidence in `reports/driver-trip-actions/` belongs to this phase; historical reports are preserved.

## Baseline

- Starting frontend main: `b9a6e4a348cb92ee7c20ecf6c842f9c51accbfd9`.
- Backend revision supplied by the user: `3c838c277b9857dddae0ca16e1efa4f580154aac`. Backend source was not accessed and its running revision was not independently inferred.
- Approved API origin: `http://localhost:8080`, configured through `NEXT_PUBLIC_API_BASE_URL`.
- Approved OpenAPI SHA-256: `222f184e98664f2e93a24e4313c8d652513ff339f7a6665a30f9f975bc02adf0`.
- Feature branch: `feat/driver-trip-actions`. Main remains unchanged; no merge, push or deployment.

Before the authorized contract replacement, main was clean. On resumption, the supplied contract was the only changed tracked file. The feature branch was created before the required generator compatibility change so implementation never took place on main. No unrelated work was discarded.

## Contract Synchronization

Previous OpenAPI SHA-256: `2b025d1d9c33407920869eea6a0cf5bf5cc6971643b28e6e0c36f54a682ae658`.

New OpenAPI SHA-256: `222f184e98664f2e93a24e4313c8d652513ff339f7a6665a30f9f975bc02adf0`.

The first `npm run api:check` rejected the newly supplied `maxProperties` keyword. The repository generator was extended to support that standard object constraint with a validated nonnegative integer bound. The repository-defined `npm run api:generate` then regenerated `src/lib/api/generated.ts`; `npm run api:check` passed. Generated artifacts were never manually edited. The approved OpenAPI file was not changed during implementation.

| Count                    | Previous | New |
| ------------------------ | -------: | --: |
| API v1 operations        |       50 |  53 |
| CSRF bootstrap operation |        1 |   1 |
| All generated operations |       51 |  54 |
| Component schemas        |       63 |  65 |

The requested **53 operations** is the API v1 count. The generator correctly reports **54 total**, including `getCsrfCookie`.

Reviewed generated changes: three new operations, `DriverTripActionInput`, `DriverTripActionMeta`, and the trip-detail response's capability metadata. The request is a strict empty object; `allowed_actions` is required, unique, and limited to the three approved enum values. Extra metadata keys are permitted by the contract but never displayed. `DriverTrip` itself and unrelated operation/schema structures are unchanged. No unrelated generated churn was found.

## New Operations Integrated

| Operation ID                  | Method | Path                                   |
| ----------------------------- | ------ | -------------------------------------- |
| `postDriverTripsTripStart`    | POST   | `/api/v1/driver/trips/{trip}/start`    |
| `postDriverTripsTripArrive`   | POST   | `/api/v1/driver/trips/{trip}/arrive`   |
| `postDriverTripsTripComplete` | POST   | `/api/v1/driver/trips/{trip}/complete` |

Every request uses the centralized client, session cookies, CSRF, a secure `Idempotency-Key`, and exactly `{}`. Generated request/path/response schemas validate the exchange and the returned resource identity must match the requested trip. These operations declare no extra local permission; none was invented. No generic trip status mutation or Admin fallback exists.

## Allowed Actions

**NO STATUS-DERIVED ACTION AUTHORIZATION**

`getDriverTrip` preserves the full generated response, including `meta.allowed_actions`. The action type derives from the generated enum. The UI filters only that array in the presentation order START, CONFIRM_ARRIVAL, COMPLETE. Empty metadata renders quiet read-only guidance; unknown or duplicate values fail generated response validation. Status and shipment rows never authorize a trip action. Home and trip-list cards remain read-only and link to detail.

The controller rechecks the latest cached metadata before creating a new attempt. An unsubmitted confirmation is bound to its detail snapshot: refreshed metadata removes it and later restoration cannot silently reopen it. Trip cache/attempt identities normalize case-insensitive ULIDs, including lowercase links and response casing changes.

## Driver Trip Detail UX

Route, current status, departure/arrival schedule, shipment count when supplied, linked shipments and manual refresh remain visible. Each operation opens an inline Arabic confirmation with the route, departure, current status, requested operation and approved consequence copy. Confirm has an action-specific accessible name; cancel/Escape return focus to the original button before submission. Pending disables duplicate confirmation and is announced. Success and safe error feedback are announced. Unknown request outcomes retain an explicit retry instead of claiming success.

## START

`بدء الرحلة` requires `START` in current metadata. Confirmation submits one POST to `/start` with immutable `{}` and a fresh secure key. No optimistic trip or shipment state is applied. A validated success displays the backend result; fixtures demonstrate DEPARTED and subsequent server-provided IN_TRANSIT shipments. A separate trip GET and relevant Driver shipment/list reads refresh the view. The frontend does not reproduce the backend cascade.

## CONFIRM ARRIVAL

`تأكيد الوصول` requires `CONFIRM_ARRIVAL`. Confirmation submits `/arrive` with the same request discipline. Fixtures demonstrate authoritative ARRIVED and subsequent ARRIVED_CITY shipment reads. The returned status is validated and rendered; the client does not calculate or enforce an expected target status locally. Relevant Driver queries refresh before further operation discovery.

## COMPLETE

`إكمال الرحلة` requires `COMPLETE`. There is no local all-delivered scan. Confirmation submits `/complete`; the authoritative result and fresh detail GET provide COMPLETED and an empty capability array in the acceptance fixture. Read-only details, shipments and manual refresh remain accessible.

## Existing Shipment Actions Interaction

The existing documented ARRIVED_CITY → READY_FOR_PICKUP and READY_FOR_PICKUP → DELIVERED actions retain their contract and permission behavior. After confirmed success, the frontend refreshes the current shipment, relevant Driver lists, and the known trip detail even when that trip query is inactive. COMPLETE appears only after this GET supplies it. A failed follow-up read cannot convert a confirmed shipment write into an uncertain mutation retry; a separate recovery notice explains the stale linked data.

## Idempotency Replay

Each logical request captures trip, action, exact method/path, frozen empty body and secure key through the existing idempotency helper. Concurrent confirmation is coalesced. A different deliberate action receives a new key. Network/5xx/429 retry uses the existing immutable attempt only.

Every HTTP 200, including `Idempotency-Replayed: true`, first renders its validated result and then forces a fresh trip GET before enabling another action. This unconditional rule handles an older replay capability snapshot without changing the shared client's success-header API. Tests supply replay headers and contradictory saved metadata and verify one success plus fresh discovery.

## 409 Recovery

The UI shows `تم تحديث حالة الرحلة. يرجى مراجعة البيانات الحالية.` and immediately fetches current trip detail. Stale controls stay blocked during recovery. A failed recovery offers a deliberate read retry; it never submits the mutation automatically or creates another key. A successful read supplies the next capabilities. No success or next status is inferred from the conflict.

## 404 Recovery

The denied trip detail is discarded, cached list copies are pruned, and Driver trip lists refresh. The unavailable screen exposes no ownership information. The pruning also works if a long pending write outlives the inactive detail query's garbage-collection interval; cancellation and captured query identities protect a replacement session. No Admin endpoint is used.

## 429 / Network / 5xx

An uncertain attempt survives navigation in memory and exposes only deliberate retry. Absolute Retry-After deadlines survive remounts; expiry does not trigger a submission. The shared Driver read cooldown also applies to recovery GETs. Network, 500 and 503 keep the same logical request. A definitive 422 discards that attempt and shows safe trip-specific feedback without raw backend field JSON. The existing 401 expiry and 403 access behavior are reused.

## Session / Logout Isolation

Retained attempts use the private Driver query namespace with no localStorage, sessionStorage, persistent token, offline queue or polling. Existing session cleanup removes them. Captured query-object identity guards ignore late unabortable results from an ended session, including a later session that recreates the same keys. Returning to a trip can offer an uncertain retry, but mounting never resubmits it. Tests cover logout, expiry, navigation, cancellation overlap and late completion.

## Privacy

Only generated Driver-safe fields are rendered. Extra metadata, raw validation JSON, internal notes, audit/financial fields, ownership diagnostics, idempotency keys and credentials are not displayed or persisted. Safe request IDs retain the existing diagnostic pattern. Dependent invalidation is limited to Driver resources; Admin and public caches are untouched except by the already established global session cleanup.

## Mobile / Responsive

Fifty measured full-page states cover all ten required states at light 390, 430, 768 and 1440px and dark 390px. Three additional phone confirmation viewports verify complete copy and both 48px controls above bottom navigation: **53 PNGs**. No horizontal overflow or undersized measured targets was found. Full-page mobile images retain fixed navigation at the initial viewport fold; separate scrolled viewports establish usable confirmation visibility.

## Accessibility

The supplied visual measurements report zero axe violations, correct RTL/theme state, no running motion under reduced-motion preference, and no private persistence. Unit/browser checks separately exercise focus entry, Escape/cancel focus return, keyboard activation, action-specific names, pending announcements and duplicate prevention. All 53 PNGs were independently opened and inspected; the finish review's disposition is **ship**, with no material visual fixes. The single mechanical design scan returned `[]`. Physical-device, software-keyboard and manual screen-reader testing are not claimed.

## Performance

Production trip detail was measured after build `zrIZKaKzzV8BxWUD-wJ5X`, with synthetic authenticated responses, START metadata, all writes blocked, and no concurrent test/build load. Lighthouse used 412 × 823 mobile and 1350 × 940 desktop profiles. Loaded content, required Driver reads, production scripts and API isolation were checked. Raw Lighthouse reports and extracted measured screenshots preserve the original run.

| Metric      | Previous mobile | Current mobile | Previous desktop | Current desktop |
| ----------- | --------------: | -------------: | ---------------: | --------------: |
| Performance |              82 |             85 |               99 |             100 |
| LCP         |        4006.6ms |       3776.0ms |          856.7ms |         792.8ms |
| TBT         |           282ms |        228.5ms |              0ms |             0ms |
| CLS         |               0 |              0 |                0 |          0.0078 |

No material regression was observed in this local run. These are individual Lighthouse lab samples, not a guaranteed improvement, field INP measurement or actual API-latency result. The small desktop CLS is reported rather than rounded to zero. Mobile performance remains an optimization opportunity outside this completed scope. See `reports/driver-trip-actions/performance/results.json` and the matching-build screenshot capture record.

Lighthouse reset viewport emulation after its audits, producing clipped supplemental screenshots. The actual measured final screenshots were inspected and valid. Supplemental capture sizing was corrected after measurement; the valid raw metrics were preserved rather than rerun. This was an evidence-harness repair, with no application change. Raw Lighthouse HTML/JSON reports remain local and Git-ignored; summaries, measured screenshots and repaired verification screenshots are committed.

## Bundle Isolation

No dependencies were added. The production trip-detail manifest/bundle audit passes: no forbidden Admin/Public source imports or table signatures. No Admin editor, public form/tracking UI, charts or TanStack Table was imported into this feature.

| Route-entry bytes | Previous | Current |          Change |
| ----------------- | -------: | ------: | --------------: |
| Decoded           |   579861 |  591979 | +12118 / +2.09% |
| Gzip              |   149609 |  152727 |  +3118 / +2.08% |

The comparison uses the same manifest/chunk/gzip accounting as the prior phase. Navigation transfer measurements include their own resource set and are not substituted for this route-entry total. Evidence: `reports/driver-trip-actions/performance/bundle-isolation.json`.

## Live Acceptance

**AUTHENTICATED DRIVER TRIP ACTION LIVE ACCEPTANCE: NOT TESTED — SAFE DRIVER FIXTURE REQUIRED**

The user confirmed that no safe Driver fixture is available. No credentials were manufactured and no real trip was started, arrived or completed. All six existing live checks pass, limited to anonymous/read-only Driver and public/HTTP behavior. Synthetic action tests establish frontend behavior, not backend live ownership enforcement or live mutation acceptance.

A separate anonymous GET `/api/v1/auth/me` returned 401 with credentialed `http://localhost:3000` CORS and exposed `X-Request-ID, Idempotency-Replayed, Retry-After`. The historical missing Retry-After exposure is therefore not carried forward as a current header gap. Actual authenticated Driver 429/replay behavior remains untested without the fixture. Evidence: `live/response-headers.json`.

## Testing

Fresh focused Driver unit coverage: **178 tests / 8 files passed**, 8.30 seconds. Full unit suite: **382 tests / 39 files passed**, 43.02 seconds. The repository's bounded worker settings, assertions, timeouts and zero browser retries are unchanged.

Full Playwright: **106 passed**, 2.7 minutes: 31 new trip-action scenarios, 33 existing Driver scenarios, 16 foundation/Admin scenarios, 13 public Order scenarios and 13 public Tracking scenarios. The new casing regression confirms a lowercase trip link can submit against the canonical response identity and complete its mandatory refresh. The final full run includes it after the fixture was corrected to accept the contract's case-insensitive ULIDs.

Live Playwright: **6 passed**, 8.2 seconds, with no authenticated Driver mutation. Contract check and generated artifact drift check pass. Final command wall-clock timings below include runner startup and shutdown.

## Admin Regression

The existing foundation/Admin browser scenarios and full unit regression suite pass without modifying Admin application logic. They cover the existing auth/session, routing, dashboard/report, shipment/trip, catalog/pricing, driver, payment and user/permission contracts at their established test scope. This phase does not repeat historical authenticated Admin writes or claim new live acceptance for them.

## Public Order Regression

All 13 existing public Order browser scenarios pass, alongside unit and read-only live coverage for catalogs, quote/review, required fields, optional kg weight, idempotent submission, authoritative confirmation, tracking handoff and responsive/privacy behavior. Public Order application files remain unchanged.

## Public Tracking Regression

All 13 existing public Tracking browser scenarios pass, alongside unit and read-only live coverage for anonymous lookup/deep links, safe field projection, manual refresh, missing resources, 429, network/service errors and order-success handoff. Public Tracking application files remain unchanged. Fresh read-only live evidence was copied into this phase; prior report artifacts were restored after the runner wrote them.

## Quality Gates

| Gate                | Fresh result                                                     | Command wall time |
| ------------------- | ---------------------------------------------------------------- | ----------------: |
| `npm run api:check` | PASS; approved hash unchanged; no generated drift                |             1.11s |
| `npm run lint`      | PASS; no suppressions; repeated after the capture-harness repair |             9.61s |
| `npm run typecheck` | PASS                                                             |             5.07s |
| `npm run test`      | PASS; 382 tests / 39 files                                       |            43.89s |
| `npm run test:e2e`  | PASS; 106 tests                                                  |           165.82s |
| `npm run test:live` | PASS; 6 read-only checks                                         |             9.24s |
| `npm run build`     | PASS; all six Driver routes produced                             |            18.33s |

Additional acceptance: 178 focused Driver unit tests; 50 measured visual states / 53 inspected PNGs; visual review `ship`; design detector `[]`; production bundle isolation PASS; mobile and desktop production performance MEASURED. Exact command logs and timing records are in `reports/driver-trip-actions/gates/`. No build-time authenticated operational data was required.

## Source Changes

Application scope is limited to these Driver files:

- `api.ts`: generated trip-action operations, retained detail envelope and immutable action factory.
- `model.ts`: generated capability/detail types and canonical trip cache identities.
- `trip-detail.tsx`: consume the envelope and mount the action area.
- New `trip-action-display.ts`: presentation order and approved Arabic labels/copy.
- New `trip-actions.tsx`: deliberate confirmation and safe action feedback.
- New `trip-action-state.ts`: retained attempts, retry/cooldown/session guards and authoritative recovery.
- New `trip-queries.ts`: scoped Driver list/shipment/trip refresh helpers.
- `actions.tsx`: shipment-success linkage and a separate follow-up-read notice.
- `use-driver-read.ts`: prune revoked list copies even after detail query garbage collection.
- `driver-workspace.css`: small spacing/layout rules reusing existing tokens and controls.

Other changes: user-supplied contract; repository generator support for `maxProperties`; regenerated API artifact; three new unit files and one new E2E file; existing Driver API/UI tests and fixture schema updates; Playwright project inclusion; two new scoped visual/performance harnesses; raw Lighthouse ignore rules; design documentation and phase evidence. No Admin/Public application logic, shared HTTP/auth behavior, package dependencies or lockfile was changed. Exact paths are in `reports/driver-trip-actions/source-changes.json`.

Two demonstrated edge defects were resolved during review: cached revoked trip rows surviving detail garbage collection, and case-insensitive ULIDs selecting different detail/attempt identities. Confirmation-snapshot and failed linkage-read regressions are also covered. Test-harness fixes corrected a hidden `<option>` status selector, JSON fixture response shape, lowercase fixture ULID matching and scrolled viewport alignment; no assertions, retries or timeouts were weakened.

## Commits

| Commit                                      | Scope                                                        |
| ------------------------------------------- | ------------------------------------------------------------ |
| `529715973977dc294d8c9eed091a2dda6f95874e`  | `chore(api): sync driver trip action contract`               |
| `53922fefad785c1c72e6774a8c832840466cf39e`  | `feat(driver): integrate authoritative trip capabilities`    |
| `6dc9aa09bf680b9afd567d98ec711984ac9712d3`  | `test(driver): cover trip action integration and acceptance` |
| Documentation commit containing this report | `docs(driver): record trip action frontend acceptance`       |

The final feature SHA, clean status, unchanged main, last ten commit entries and exact baseline-to-final file list are recorded after the documentation commit in [the final source-state record](C:/Users/Mohamed/.codex/visualizations/2026/09/13/01a09a82-f5a8-79a1-aa24-83ca1f166784/porta-driver-trip-actions-final-source-state.json). This external record avoids a self-referential commit hash inside the report. No history was rewritten.

## Remaining Gaps

| Classification       | Scope                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FRONTEND GAP         | No known supported-flow defect is accepted as a gap. Physical-device and manual assistive-technology acceptance remains unperformed. Final performance comparison is documented separately.                                                       |
| BACKEND CONTRACT GAP | None for the three requested trip actions or capability metadata. Historical unrelated Driver profile/day-aggregate/filter limitations remain outside this extension. The old “no Driver trip mutations” gap is closed by this approved contract. |
| TEST DATA GAP        | No approved disposable authenticated Driver account, trip-action mutation fixture or live cross-driver ownership fixture.                                                                                                                         |
| ENVIRONMENT GAP      | Local synthetic production measurements exclude real API latency and field INP. Production/staging DNS/TLS and deployment are not accepted in this phase.                                                                                         |
| DEFERRED FEATURE     | GPS, maps, streams, polling, PWA/offline queue, proof of delivery, scanning, Driver profile editing, new Admin features and deployment remain unstarted. No local trip lifecycle reconstruction was introduced.                                   |

## Final Result

**DRIVER TRIP ACTIONS FRONTEND INTEGRATION PASSED WITH DOCUMENTED GAPS**

All three requested operations are integrated; generated capabilities exclusively control their availability. The final regression, contract, build, visual and production checks pass within their recorded scopes. The final OpenAPI SHA is unchanged from the approved replacement, and generated contract drift is absent. The remaining limitations are the absent live Driver fixture, physical-device/manual assistive-technology acceptance, and local-only performance evidence. No supported action is treated as broken-but-acceptable.

Main is unchanged. The feature remains on `feat/driver-trip-actions`, with the clean final state recorded above. Work stops at this report; no merge, push, deployment or deferred feature was started.
