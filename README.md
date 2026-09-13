# Porta Delivery Admin

Arabic-first RTL Next.js administration frontend. The Laravel backend is a separate HTTP service. This project has no backend source, filesystem or database dependency.

## Local setup

Use Node.js 24 and the locked dependencies:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [the login page](http://localhost:3000/login). Use **localhost**, because the approved local API is `http://localhost:8080` and its session/CSRF cookies use that hostname. `127.0.0.1` is a different cookie host. The development server is local only.

The approved contract is [contracts/porta-api-v1.openapi.json](contracts/porta-api-v1.openapi.json), supplied for API v1 baseline `c2682c4e5ee01beefd1ef467a1df303a79409b08`. Its API version is `1.0.0`. The running container's commit is not exposed by this contract and has not been independently verified.

## Configuration

```dotenv
NEXT_PUBLIC_APP_MODE=connected
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_AUTH_LOGIN_PATH=/api/v1/auth/login
NEXT_PUBLIC_AUTH_LOGOUT_PATH=/api/v1/auth/logout
NEXT_PUBLIC_ENABLE_PREVIEW=true
```

The API origin appears only in environment configuration, never feature code. Public environment values are embedded at build time: restart development or rebuild when changing them. Do not put secrets in public variables. No production/staging domain has been approved.

`NEXT_PUBLIC_APP_MODE=foundation` explicitly disables API communication. Preview routes require the development-only opt-in and always return 404 in production. They contain isolated, labelled component fixtures and never emulate API responses.

## Architecture and integration

Server components own layouts, route selection, metadata and recovery boundaries. Interactive features fetch private operational data in the browser through the centralized `src/lib/api/client.ts`, with cookie credentials, CSRF, cancellation, runtime validation and safe Arabic errors. There are no bearer tokens, private response persistence, backend proxies or backend source imports.

`npm run api:generate` produces Zod validators and inferred TypeScript types from the supplied local OpenAPI file. The generator supports the vocabulary used by this contract and fails on unsupported validation keywords. Generated envelopes, conditional input requirements, enum values, money limits, query parameters and operation metadata are checked into `src/lib/api/generated.ts`. `npm run api:check` detects drift. Backend validation and authorization remain authoritative.

Authentication uses `/sanctum/csrf-cookie`, `/api/v1/auth/login`, `/api/v1/auth/me` and `/api/v1/auth/logout`. Session expiry cancels/clears private queries and preserves a safe local return path. Permissions come from the current session; navigation uses the exact documented permissions, without role-based assumptions. Settings are local preferences for an authenticated user.

TanStack Query caches remain in memory. Writes wait for server confirmation, invalidate affected resources and never retry automatically. Logical critical writes retain their idempotency key and original payload for controlled retries. Request JSON must be an object no larger than 65,536 bytes. Financial values are safe integer LYD millimes; decimal display conversion does not calculate prices.

## Screens

The connected routes are `/dashboard`, `/shipments`, `/trips`, `/drivers`, `/cities`, `/branches`, `/shipment-types`, `/pricing`, `/payments`, `/reports`, `/users`, `/audit` and `/settings`.

Shipments use approved server filters, sorting and cursor pagination, real detail data, authoritative quote requests, manual creation, contact edits and driver assignment. Reports/dashboard show returned aggregates and date series. Catalogs and operational lists use their documented cursor or page metadata. Payments are accessed through a shipment-specific ledger because no aggregate payments endpoint exists.

See [the implementation report](docs/IMPLEMENTATION-REPORT.md) for exact delivered controls and verification. [Integration gaps](docs/API-INTEGRATION-GAPS.md) distinguish absent API capabilities from remaining authenticated acceptance checks. No workflow transitions, timeline events, pricing breakdowns or analytics are fabricated.

## Verification

```powershell
npm run api:check
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run check:integration
npm run test:live
npm run build
npm run start -- --port 3001
npm run check:production
```

The foundation browser suite runs independently on port 3100 in `.next-foundation-test`, without changing the connected environment. `test:live` uses the actual local API and a fresh unauthenticated browser on `localhost:3000`; it verifies contract responses, CORS/cookies, login availability, accessibility and protected-route redirects. It performs no staff login or business writes. No test records or credentials are created automatically.

`check:integration` saves status, schema, cookie flags and CORS evidence in `reports/integration/http-check.json`; it never saves cookie values or private API payloads. Staff-authenticated read/write acceptance requires an approved account and disposable local records.

Production smoke checks verify preview exclusion, configured login availability and response headers. Port 3001 is for build verification only; the supplied backend CORS origin is port 3000. Use `PORTA_CHECK_MODE=foundation` only when deliberately testing a foundation build. Historical foundation performance evidence remains under `reports/performance`; it is not a benchmark of the new authenticated screens.
