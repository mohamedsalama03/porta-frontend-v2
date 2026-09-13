# Operational acceptance findings — 13 September 2026

## F1 — Trip datetime round-trip shifts by two hours

Classification: **BACKEND IMPLEMENTATION DEFECT (inferred attribution)**. The integration failure is reproduced; its backend storage/serialization cause is not independently proven.

QA trip `01m2dwqsp1angqezd73gaagytt` was created through the existing form with Libya departure `2026-09-14T10:00` and arrival `2026-09-14T12:00`. Its returned detail and reopened edit form showed `12:00` and `14:00`. A controlled edit, with DOM values recorded immediately before submission, sent the intended wall-clock inputs `10:00` and `13:00`; detail then showed `12:00` and `15:00`.

Independent execution of the existing frontend conversion shows `10:00` becomes `2026-09-14T10:00:00+02:00` and round-trips to `10:00`; validators and JSON transport do not alter the timestamp. Exact authenticated raw request/response timestamps could not be captured by the available browser tool. No offset compensation or backend change will be introduced.

## F2 — Misleading generic operation conflict feedback

Classification: **FRONTEND DEFECT**. Reproduced before any source change.

Attaching the single QA shipment `01m2dwmhj3j3qgvga408yc7z58` to that QA trip produced conflict feedback with request ID `c7d81d01-00dc-4bbf-ab23-8d34dc5d39e2`. The UI asserted that another user had updated the data and that the latest state had been loaded. The response class alone establishes neither claim. `WriteFeedback` applies this wording to every 409.

The permitted focused fix is neutral Arabic conflict feedback that asks the user to review current data and retains the request ID. Add regression coverage for this wording; do not change request payloads, retry rules, backend behavior, or OpenAPI.

**FIXED:** `src/features/operations/editor.tsx` now uses neutral conflict wording and preserves the request ID. `tests/unit/operation-writes.test.tsx` covers the guidance and absence of false claims; all 10 focused tests passed.

## F3 — QA trip attachment rejected

Classification: **BACKEND CONTRACT GAP — unresolved conflict reason/eligibility** pending evidence. Do not infer the backend's hidden eligibility rules.

The shipment is RECEIVED, not delivered, on the same QA route, assigned to the same QA driver, and has no trip. The trip is SCHEDULED. The contract excludes route mismatches, delivered shipments, and shipments attached to another trip; it documents no PREPARING prerequisite. The attempted attach was rejected, leaving zero members. The exact backend conflict reason is unavailable through the current sanitized UI. Do not change lifecycle state or retry automatically to bypass the conflict.

## F4 — Trip selection UI coverage

Classification: **DEFERRED FEATURE**. The existing attachment control accepts IDs from shipment detail URLs. It does not expose the server-backed search/pagination selection requested in this acceptance checklist. Membership display itself is paginated. Do not redesign or build a new picker in this acceptance task.

## F5 — Pricing edit loses selected catalog references after a fresh load

Classification: **FRONTEND DEFECT**. Reproduced before a fix.

After a full navigation to `/pricing?active=true`, opening the existing QA rule's edit dialog showed the correct amount, size and active state but blank origin, destination and shipment-type selections. The option lists contained the actual QA values. A separate later DOM read confirmed all three select values remained empty. No write was submitted from this incomplete editor.

Expected: authoritative saved city/type selections remain selected as the asynchronous catalog choices load. Diagnose and fix only the reference-selection initialization, with focused regression coverage. Do not invent missing catalog data or alter the saved rule.

**FIXED:** Pricing and branch regression cases reproduced replacement of a temporary selected option with asynchronous choices, leaving an uncontrolled select empty. `src/features/catalog/actions.tsx` now binds select values through React Hook Form's Controller. All 7 catalog action tests passed, including active-only PATCH coverage. A fresh live pricing edit retained all three saved QA references, and safe deactivation succeeded afterward.
