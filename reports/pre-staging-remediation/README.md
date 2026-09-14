# PORTA DELIVERY
# PRE-STAGING REMEDIATION REPORT

Date: 2026-09-14. Scope: ISA-003 Driver shipment cache/privacy remediation and ISA-006 dashboard loading semantics only.

## Baseline

The original frontend was independently verified clean on `main` at `f43f0572a50dcc40cc29181f262e9fa8575c325f` before changes. Work proceeded on `fix/pre-staging-privacy` in `D:/customers/porta frontend`. The user-approved backend baseline is `3c838c277b9857dddae0ca16e1efa4f580154aac`; backend source/revision was not inspected. API integration remains through the existing centralized client and approved `http://localhost:8080` configuration.

Initial `api:check` passed. The raw contract SHA and both frozen working-file Git blob hashes matched their approved values and corresponding HEAD blobs independently of the temporary assume-unchanged index flags. Those flags and repository-local `core.autocrlf=false` were retained.

## ISA-003 Reproduction

The new permanent test reproduced the failure against unchanged baseline application code before the fix: a lowercase shipment route received the same canonical uppercase shipment, rendered contacts, then the existing canonical status action received scoped HTTP 404. After the unchanged assertion window, both names, both phone numbers, the delivery address and tracking number still appeared in full DOM text, including hidden text. Two telephone links, the shipment detail region and action region also remained. There were no unexpected or Admin API requests. The intercepted deterministic fixture performed no live write.

The exact same regression passed after remediation. Before/after requests, DOM evidence and Playwright results, plus the pre-fix screenshot and trace, are preserved externally under `D:/porta-prestaging-remediation-20260914/driver-e2e`.

## ISA-003 Root Cause

`driverKeys.shipment(id)` previously retained route casing. Shipment reads used the lowercase route parameter while mutations, successful cache updates and revocation used the uppercase `shipment.id` returned by the API. Exact query lookup therefore missed the retained lowercase private detail. The API already accepted equivalent ULID casing; rejecting the deep link would not address the defect. Existing list pruning compared case-insensitively, but did not repair the separate detail cache identity. Existing session-wide cleanup worked and was preserved.

## Cache Identity Strategy

One helper, `driverShipmentIdentity`, uses the frozen generated ULID validator and canonicalizes only valid ULIDs to uppercase. Invalid route values and opaque cursors remain unchanged. `driverKeys.shipment` is the shared boundary for reads, mutation lookup, cancellation, updates, invalidation and revocation. Shipment component keys, list pruning and trip-dependent shipment exclusions use that helper. Initial valid lowercase HTTP paths remain accepted; no identifier is invented or assigned a different resource meaning.

Concurrent lower/uppercase observers share one query and one read. Normal new detail reads retain one logical private record. Defensive revocation also finds all already-retained legacy casing aliases. Trip key normalization and trip action architecture remain unchanged.

## 404 Revocation Behavior

The shared read/mutation revocation path removes private data from every matching shipment detail query, records the existing denial state, and cancels pending equivalent reads without restoring old data. A failing active read completes its own rejection after cleanup. Matching rows are pruned from all Driver shipment list variants, including trip-linked lists and casing variants. Remaining rows, metadata, unrelated shipment details, trip details and Admin queries are retained. No global cache wipe is used for a normal scoped 404.

## Private Data Removal

After scoped mutation404, the permanent browser test requires all six private/contact/tracking values to be absent from full DOM text, zero telephone links, zero shipment detail/action regions, and the existing safe unavailable message. The corresponding component/unit regression checks the same removal. Both read404 and mutation404 tests additionally inspect every retained cache alias and linked list. A visible error banner alone is not considered sufficient.

## Late Response Protection

Pending equivalent detail and list queries are cancelled with `revert:false`. The read helper checks the consumed AbortSignal again after a response resolves, so an unabortable late success cannot be returned as current data. Cleanup captures Query object identity and rechecks it after awaits; it cannot recreate an ended-session query or clear a replacement session's query with the same key. Deterministic tests resolve delayed detail/list responses after revocation and verify they do not restore private data.

## Cross-Session Isolation

Existing logout/session-expiry cache clearing and mounted action guards remain unchanged. A new browser test loads Driver A's lowercase shipment, logs out, starts a different Driver B identity, verifies empty assigned work and no A contacts, then opens the former detail route and verifies its safe 404 state. An additional unit race overlaps revocation, logout and an old pending response with a replacement-session query and verifies only the replacement data survives.

## Lowercase / Uppercase Acceptance

Valid lowercase and uppercase detail routes both render the canonical response through one key. Existing uppercase and new lowercase successful action flows remain covered for `ARRIVED_CITY → READY_FOR_PICKUP → DELIVERED`. Confirmation, duplicate-submit protection, endpoint payloads, idempotency and authoritative status behavior were preserved. Invalid or arbitrary strings are not normalized into invented valid identifiers.

## ISA-006 Root Cause

The generic `.report-loading` div used `aria-label` without a semantic role that permits that accessible name. The exact prior 390 × 844 Arabic RTL loading state reproduced axe `aria-prohibited-attr` before the semantic change.

## Dashboard Loading Accessibility Fix

The existing wrapper now has `role="status"` and `aria-atomic="true"`, with one existing Arabic loading message in a visually hidden span. Decorative metric/chart skeletons use `aria-hidden="true"`. There is one announcement region, no axe suppression and no CSS or layout change.

The exact WCAG 2 A/AA and 2.1 AA axe scenario changed from one violation to zero. An additional unrestricted after run also had zero violations. The loading frame remained exactly x=16, y=341.796875, width=358, height=616 before/after. All five skeletons remain visible; RTL and reduced motion are preserved, with no horizontal overflow. The browser regression releases the held contract-valid report response and confirms normal report rendering. No report API behavior changed.

Detailed axe, geometry, before/after screenshot and test evidence: [ISA-006 evidence report](D:/porta-prestaging-remediation-20260914/a11y/ISA-006-REPORT.md).

## Focused Tests

- Driver units: 118/118 across five files, including 11 new shipment identity/privacy cases.
- Driver browser regressions: 9/9, one worker, zero retries, 16.2 seconds. Exact privacy case: 858 ms after fix.
- Dashboard loading plus existing operations units: 14/14 across two files, including two new loading cases.
- Permanent dashboard loading browser regression: 1/1; exact before/after axe and geometry evidence retained.
- Scoped lint and independent TypeScript check passed; read-only independent review found no actionable correctness defect.

Three permanent Driver browser cases were added: exact lowercase revocation privacy, lowercase successful actions, and different Driver identity after logout. Existing assertion strength, retry counts and timeouts were not reduced. Existing unit placeholders `first`/`second` became valid ULID fixtures, with the first intentionally lowercase; existing assertions remain intact.

## Driver Regression

PASS: all 67 Driver browser cases passed, covering shipment/trip detail and actions, 404/403/401 handling, logout, session expiry, privacy and mobile navigation. The full unit gate also includes every existing Driver test. Existing uppercase shipment actions and the new lowercase action flow remain green. New exact scoped-404 removal passes permanently in the standard suite; pending-response and concurrent-case races pass in the unit suite.

Live Driver coverage is limited to the anonymous route guard: four permitted `GET /api/v1/auth/me` reads (limit four), 401 and safe login return, with zero blocked/unexpected operations. Authenticated Driver actions were deterministic, not live; no Driver account or assigned-work fixture was supplied.

## Admin Regression

PASS: the new connected Admin loading browser test, both loading units and existing operations/report tests pass. The browser suite also passes all 16 foundation cases. Report response validation/rendering, permissions and request behavior remain unchanged. This is regression evidence, not a fresh authenticated Admin operational campaign.

## Public Regression

PASS: 13 Public Order and 13 Public Tracking deterministic browser cases pass. Public application source is unchanged. Live public booking loads real catalogs and handles availability safely; existing disposable tracking is read twice (lookup and refresh), both HTTP 200, with valid strict contract/privacy checks, no imported authentication and zero blocked/unexpected requests. No new order or operational/payment write was made.

## Quality Gates

All commands ran fresh against verified copies of code candidate `ec4153570fa14f23d9bc774076a3aace853ac9a2`. Counts below come from this run, not historical acceptance.

| Command | Result | Measured command duration |
| --- | --- | --- |
| `npm run api:check` | PASS; no drift | 2.044 s |
| `npm run lint` | PASS | 38.255 s |
| `npm run typecheck` | PASS | 14.284 s |
| `npm run test` | PASS; 395 tests across 41 files | 63.288 s; Vitest reports 60.57 s |
| `npm run test:e2e` | PASS; 110 tests, zero retries | 176.468 s; Playwright reports 2.9 min |
| `npm run test:live` | PASS; 6 tests within read-only fixture limits | 8.663 s; Playwright reports 6.1 s |
| `npm run build` | PASS; optimized production build, 14/14 static pages | 31.252 s |

E2E distribution: 16 foundation, 1 connected Admin loading, 67 Driver, 13 Public Order and 13 Public Tracking. No assertion, rule scope, validator, retry, timeout or existing test was weakened or skipped to obtain these results.

ISA-002 remains a disclosed acceptance tooling issue: E2E rewrote `next-env.d.ts` in its isolated copy; live rewrote `reports/driver-interface/live/anonymous-guard.json` and `reports/public-tracking/live/acceptance.json` in its isolated copy. These changed copies are preserved as evidence. Core gates and build did not change captured source files. No changed tracked file was silently restored or hidden in the feature checkout. Dependencies were copied without installation/upgrades; candidates, temporary files and npm cache stayed on D:. The live runner reused the approved local development runtime and read-only dependency junction, without a new production server.

Raw command logs and per-gate candidate/original before-and-after hashes are retained under `D:/porta-prestaging-remediation-20260914/gates`. Build passed its own prebuild contract check, compilation, TypeScript and static generation. This does not claim a fresh production runtime or Lighthouse measurement.

## OpenAPI Freeze

Expected raw SHA-256: `222f184e98664f2e93a24e4313c8d652513ff339f7a6665a30f9f975bc02adf0`.

| Frozen file | Working bytes / HEAD Git blob |
| --- | --- |
| `contracts/porta-api-v1.openapi.json` | `9c35b5b8994347806a8c6e157096456a5de33372` |
| `src/lib/api/generated.ts` | `a46600ca3c1dbd46748255cc1090e10e3217c385` |

**OPENAPI / CONTRACT FREEZE: PASS.** No OpenAPI edits, generated contract edits, regeneration, normalization or restore were performed on either frozen path. Initial, candidate and final original `api:check` checks pass: **no contract drift**. Final certutil SHA, working Git hashes and HEAD blobs independently match the values above; the EOL-insensitive frozen-file diff exits zero. Assume-unchanged is not used as correctness evidence. Generated API artifact changes: **NONE**.

## Source Freeze

**SOURCE FREEZE: PASS for the remediated candidate.** The tested code candidate is `ec4153570fa14f23d9bc774076a3aace853ac9a2`, clean on `fix/pre-staging-privacy`. The gate harness snapshots all 608 tracked/nonignored files as raw bytes, verifies each isolated candidate before execution and independently verifies the original after every gate. Original application source remained fixed throughout acceptance.

After the seven-gate run, the only additional tracked change is this report in a focused documentation commit whose parent is the tested candidate. Final branch/worktree status is clean. All 608 captured source files, their existing index flags and `core.autocrlf=false` remain unchanged after that commit and final `api:check`. `main` remains at `f43f0572a50dcc40cc29181f262e9fa8575c325f`. The final HEAD, complete recent commit log, porcelain status, raw source comparison and frozen-file proof are recorded in [final-freeze.json](D:/porta-prestaging-remediation-20260914/final-freeze.json). This avoids embedding the documentation commit's own hash into its contents.

## Changed Files

| Path | Exact purpose |
| --- | --- |
| `src/features/driver-workspace/model.ts` | Valid-ULID identity helper and canonical shipment detail query key |
| `src/features/driver-workspace/use-driver-read.ts` | All-alias denial cleanup, helper-based list pruning and post-response cancellation guard |
| `src/features/driver-workspace/trip-queries.ts` | Use shared shipment identity when excluding a shipment from dependent refresh |
| `src/features/driver-workspace/home.tsx` | Stable canonical shipment card key |
| `src/features/driver-workspace/shipment-list.tsx` | Stable canonical shipment card key |
| `src/features/driver-workspace/shipment-detail.tsx` | Stable canonical shipment action component key |
| `src/features/operations/reports.tsx` | Valid loading status and hidden decorative skeleton semantics |
| `tests/unit/driver-shipment-identity.test.tsx` | Eleven identity/privacy/race/session regression cases |
| `tests/unit/driver-query.test.tsx` | Replace two opaque placeholder IDs with valid lower/uppercase ULIDs |
| `tests/e2e/driver-workspace.spec.ts` | Three permanent lowercase/privacy/session regression cases |
| `tests/unit/dashboard-loading.test.tsx` | Two dashboard/report loading semantic regressions |
| `tests/e2e/dashboard-loading.spec.ts` | Permanent 390px loading-state axe/RTL/overflow/reduced-motion regression |
| `playwright.config.ts` | Connect new Admin browser case to existing connected test server |
| `reports/pre-staging-remediation/README.md` | This remediation report |

No other application, API, permission, lifecycle, public product, style or dependency changes were made. Raw browser evidence and disposable gate outputs remain outside the repository.

## Commits

| Commit | Purpose |
| --- | --- |
| `db63b80` | `fix(driver): canonicalize shipment cache identity` |
| `0167fc1` | `test(driver): cover shipment revocation privacy` |
| `ec41535` | `fix(a11y): correct dashboard loading semantics` |
| Final documentation commit | `docs(acceptance): record pre-staging remediation`; identified by final Git log and external final-freeze evidence |

No merge, push, tag or deployment was performed. `main` remains at the approved baseline.

## Remaining Findings

| Finding | Disposition |
| --- | --- |
| ISA-001 — INFO | Resolved checkout fidelity remains verified through raw SHA/HEAD checks. Temporary assume-unchanged flags still require independent checks. |
| ISA-002 — INFO | Tooling still writes tracked output paths; mitigated by preserved verified copies. Configurable output paths remain a separately scoped tooling improvement. |
| ISA-003 — HIGH | Remediated: exact regression, full DOM/cache cleanup, casing convergence, late response and session tests pass. |
| ISA-004 — INFO | Retained fixture/session limitations: no approved authenticated Driver assigned-work/mutation fixture or safe payment fixture; no fresh authenticated Admin operational run or new public-order creation. |
| ISA-005 — INFO | D: candidates/temp/cache mitigate this campaign's storage constraint. Historical C: disposable copies and production-startup restriction were not changed; fresh Lighthouse was outside this remediation and is not claimed. |
| ISA-006 — LOW | Remediated: exact loading-state axe violation is absent, with unchanged visual geometry, RTL and reduced motion. |

No new HIGH/BLOCKER defect was demonstrated in the scoped review and completed regressions. Manual screen-reader/physical-device testing, production DNS/TLS/CORS/latency and deployment remain outside this run. Previously documented Admin touch-size/long-value observations and broader staging limits are not silently reclassified. This report does not claim a repeat of the entire staging campaign or live Driver mutation acceptance. No backend, contract, generated API schema, lifecycle, GPS/maps, proof-of-delivery or deployment work was performed.

## Final Result

**PRE-STAGING REMEDIATION PASSED WITH DOCUMENTED GAPS**

ISA-003 is resolved by the exact permanent pre-fix/fixed regression, complete private-data removal, canonical cache identity, late-response protection and session isolation. ISA-006 is resolved with zero violations in the exact axe loading scenario. All seven fresh quality gates, source freeze and contract freeze pass. No new HIGH/BLOCKER finding was demonstrated.

The qualification is limited to unavailable authenticated live fixtures and retained environment/test coverage limits; it does not excuse a remaining privacy failure. The local remediation branch is ready for review. No merge, push or deployment was performed, and work stops with this report.

Evidence: [Driver before/after report](D:/porta-prestaging-remediation-20260914/driver-e2e/DRIVER-E2E-REMEDIATION.md), [dashboard loading evidence](D:/porta-prestaging-remediation-20260914/a11y/ISA-006-REPORT.md), [gate report](D:/porta-prestaging-remediation-20260914/gates/GATE-REPORT.md), [final freeze](D:/porta-prestaging-remediation-20260914/final-freeze.json), and [final original api:check](D:/porta-prestaging-remediation-20260914/final-api-check.log).
