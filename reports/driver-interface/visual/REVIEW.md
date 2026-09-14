# Driver interface visual acceptance

Result: PASS for the captured synthetic presentation states.

The reproducible check is `node scripts/check-driver-interface.mjs`. It uses the existing local frontend with intercepted cookie-session and driver-scoped read fixtures. All other API/external requests and all writes are blocked. No live driver account or operational mutation is involved.

The run produced 43 full-page captures and six additional mobile action viewport captures:

- Home, trips, trip detail, shipments, shipment detail, empty, error and inline confirmation at 390, 430, 768 and 1440 pixels.
- Home, trip detail and shipment detail at 1024 pixels.
- All eight states in dark mode at 390 pixels.

Every capture passed the automated Arabic RTL, theme, horizontal overflow, visible touch target, input font size, reduced-motion and private-storage checks. Primary operational controls met 48 pixels and secondary controls met 44 pixels. The 43 axe checks using WCAG 2 A/AA and WCAG 2.1 AA tags returned no violations. Request summaries, individual measurements and screenshot paths are in `results.json`.

## Bounded visual inspection

Ten representative screenshots were opened and inspected:

1. `light-390-home.png`
2. `light-390-trip-detail.png`
3. `light-390-shipment-detail-action-viewport.png`
4. `light-1440-home.png`
5. `light-430-trips.png`
6. `light-768-shipments.png`
7. `dark-390-confirmation-action-viewport.png`
8. `light-390-empty.png`
9. `light-430-error.png`
10. `light-1024-shipment-detail.png`

Cards, Arabic headings, route and status information, filters, phone controls, and confirmation controls were readable and aligned. Mobile screens use one column and bottom navigation; wider screens use top navigation and suitable card columns. The empty and error views retain useful refresh controls. The dark confirmation has a clear action and visible return control. No material visual defect was found in this bounded pass.

Full-page mobile screenshots retain fixed bottom navigation at the initial viewport fold, which can cover that portion of the stitched image. The additional action viewport screenshots show the real scrolled phone viewport and confirm that the operational controls are visible above navigation. This is a screenshot-composition limitation rather than evidence that all page content is visible simultaneously.

This evidence covers deterministic Chromium rendering, not physical devices, assistive-technology use, every possible text length or live backend data. Automated axe checks do not establish complete accessibility conformance.
