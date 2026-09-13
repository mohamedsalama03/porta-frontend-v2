# Porta Delivery

## Product

An Arabic-first administration workspace for an intercity delivery service in Libya. Operators coordinate shipments, trips and drivers, and manage catalogues, pricing and payments. Backend API v1 baseline: `c2682c4e5ee01beefd1ef467a1df303a79409b08`.

## Users and success

Dispatch and branch operators need fast, dependable daily workflows. Administrators need permission-aware management and traceable, server-confirmed financial operations. Success means readable dense data, clear authoritative state, keyboard access and excellent RTL behaviour across desktop and mobile.

## Platform and stack

Independent web frontend. Next.js App Router, strict TypeScript, Tailwind, Motion, TanStack Query/Table, React Hook Form, Zod and Lucide. The Laravel service is external and accessible only over HTTP. No backend filesystem access or domain logic duplication.

## Brand commitments

User specified calm, premium, minimal operational SaaS. Cairo Arabic typography; RTL primary with future LTR architecture. Thin borders, restrained colour, compact statistics and tables. Light and dark themes. No elaborate invented logo, excessive gradients or glass effects. Linear, Vercel and Stripe establish the craft bar, not a template to copy.

## Confirmed scope

Build incrementally: A foundation/auth/layout, B overview, C shipments, D trips/drivers, E catalogues/pricing, F payments/reports, G users/audit, H quality. Stop before public ordering, public tracking, driver app, GPS or deployment.

## Integration boundary

The workspace was empty at intake. The user subsequently supplied the approved frontend-local `contracts/porta-api-v1.openapi.json` and Docker API origin `http://localhost:8080`. Integrate only through this contract and actual HTTP responses. The browser frontend must use `localhost:3000` for the approved cookie/CORS configuration. No backend source access is permitted. Missing capabilities remain documented in `docs/API-INTEGRATION-GAPS.md`; data, workflow transitions and endpoint schemas must not be invented.

## Session assumptions

Temporary restrained teal brand accents and warm neutral surfaces serve the explicit aesthetic. Interface previews may use component-level fixtures with explicit preview labelling and must be unavailable in production. Previews never impersonate an authenticated user or send writes. These are implementation assumptions, not new product claims.
