# Driver trip action correctness review

Date: 2026-09-14

## Scope

Independent review of the frontend changes against `b9a6e4a348cb92ee7c20ecf6c842f9c51accbfd9`, focused on `src/features/driver-workspace/api.ts`, `trip-action-state.ts`, `trip-actions.tsx`, `trip-queries.ts`, `actions.tsx`, `use-driver-read.ts`, and their cache, authentication, and navigation call sites. Related controller, API, UI, and end-to-end tests were inspected.

The review covered server-provided `meta.allowed_actions`, immutable logical attempts with idempotency keys and empty request bodies, explicit uncertain-result retries, fresh detail reads after successful/replayed writes and conflicts, denial revocation, session cleanup, and dependent shipment/trip refreshes. No backend repository or sibling directory was accessed. No application files were edited and no tests were run by this reviewer.

## Finding and resolution

**P2 — Case-insensitive trip IDs previously produced different cache and attempt identities. Resolved.**

The contract accepts ULIDs in either case. Originally, a valid lowercase route cached its detail under the lowercase ID, while the action controller used the returned resource ID. An uppercase response therefore displayed the permitted action but silently prevented submission because the controller looked up a different cache key. A response casing change could also select another attempt-state entry during recovery.

The resolution was verified by reading the changed implementation:

- `src/features/driver-workspace/model.ts` normalizes `driverKeys.trip(id)` to uppercase.
- `src/features/driver-workspace/trip-action-state.ts` normalizes both `driverTripAttemptKey(tripId)` and the controller's captured trip ID to uppercase.

These paths now share one trip cache identity and one logical attempt identity regardless of route or response casing. The bounded follow-up inspected the two new controller regression tests: lowercase route with uppercase response, and retention of the same uncertain request/idempotency key across a response casing change. They cover the reported triggers. Their execution was handled by the coordinating task; this review did not independently rerun them.

## Outcome

The reported finding is resolved. No other material correctness, security, or regression findings were identified within the original review scope. This is a scoped code review, not a claim of exhaustive verification. The follow-up was limited to confirming the reported fix and inspecting its regression coverage.
