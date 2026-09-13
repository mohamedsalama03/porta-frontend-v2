<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Porta project boundary

Work only in this independent Next.js frontend. The backend is a separate external HTTP service. Never search for backend repositories, sibling directories, PHP source, migrations or database access. Do not copy or implement backend business rules. Use the centralized API client and only an approved contract provided inside this frontend or through approved HTTP documentation.

API v1 baseline: `c2682c4e5ee01beefd1ef467a1df303a79409b08`. In foundation mode, do not invent endpoints or API responses. Missing integration requirements are recorded in `docs/API-INTEGRATION-GAPS.md`. Development component fixtures must remain behind production-disabled preview routes. Keep Arabic RTL, permission checks, safe errors and reduced-motion support intact.
