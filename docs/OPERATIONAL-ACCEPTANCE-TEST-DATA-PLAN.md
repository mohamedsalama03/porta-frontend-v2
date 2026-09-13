# Porta operational acceptance — disposable data plan

Prepared before the first write on 13 September 2026. Scope: the existing authenticated frontend at `http://localhost:3000`, configured for the local API at `http://localhost:8080`; approved contract unchanged.

Unique prefix: **`PORTA-QA-20260913-1715`**. This is synthetic acceptance data, not real customer or operational data.

| Entity        | Maximum successful records | Identification                                                                 | Planned final state                                                                              |
| ------------- | -------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Cities        | 2                          | Prefix plus CITY-A / CITY-B; compact codes `QA0913A1715` / `QA0913B1715`       | Inactive where safely supported.                                                                 |
| Branch        | 1                          | Prefix plus BRANCH-A; synthetic QA address, optional phone omitted             | Inactive where safely supported.                                                                 |
| Shipment type | 1                          | Prefix plus TYPE; compact code `QA0913T1715`                                   | Inactive where safely supported.                                                                 |
| Driver        | 1                          | Prefix plus DRIVER; synthetic required phone, no user account association      | Inactive only if no active work remains; otherwise retained active and documented.               |
| Pricing rule  | 1                          | Exclusively QA cities/type; returned ID recorded because no name/note exists   | Deactivated after quote/shipment checks.                                                         |
| Shipment      | 1                          | Prefix in synthetic names/address/note; synthetic phones only                  | Retained with QA prefix; no historical deletion or unsupported lifecycle operation.              |
| Trip          | 1                          | Exclusively QA cities/driver; returned ID recorded because no name/note exists | Detach QA shipment after check; retain if cancellation is not safely exposed by the existing UI. |

Use only the permitted create/PATCH and documented assignment/membership workflows through the existing frontend. All created records will be listed with identifiers and final observed states in the final report. No unrelated record will be edited.

Pricing will use an exact three-decimal test amount (initially 1.234 LYD = 1234 millimes; harmless edit to 1.235 LYD). A conflict attempt may submit a duplicate of this QA rule only after the first rule exists; an unexpected success must be recorded and safely deactivated, not hidden.

Check workflow controls before each action for the current account's permission. Test form validation without bypassing client validation. Backend 422/409 checks require actual safe UI-supported triggers; document unavailable coverage honestly. Do not build an invasive retry harness or deliberately exhaust rate limits.

No payment mutation is planned: a dedicated approved payment fixture has not been supplied. Verify the disposable shipment's empty ledger only. Users/audit remain permission dependent. No staff account creation or permission expansion.

No backend access, OpenAPI changes, direct lifecycle controls, production data, credential/cookie export, or deployment. Application edits are allowed only for a reproduced frontend defect with focused regression coverage.
