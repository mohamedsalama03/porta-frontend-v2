# Approved API contract

The user supplied `porta-api-v1.openapi.json` inside this independent frontend project and approved `http://localhost:8080` for local integration.

- OpenAPI: 3.1.0; API version: 1.0.0.
- Requested backend baseline: `c2682c4e5ee01beefd1ef467a1df303a79409b08`.
- SHA-256: `90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4`.
- Generate: `npm run api:generate`.
- Detect generated-schema drift: `npm run api:check`.
- Read-only actual HTTP verification: `npm run check:integration`.

The contract is used without modification. All references are local to this document. Generation does not read a backend repository or fetch remote definitions. The generated file includes validators/types for 63 component schemas and metadata/validators for 51 operations; generation alone does not mean every operation has a user interface or a completed live acceptance test.

Production/staging origin, DNS and TLS remain separate deployment inputs. See `docs/API-INTEGRATION-GAPS.md` for missing capabilities and acceptance requirements.
