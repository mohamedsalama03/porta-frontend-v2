---
name: Porta Driver trip actions
description: Deliberate Arabic trip operations within the existing Driver workspace.
colors:
  primary: 'var(--accent)'
  primary-hover: 'var(--accent-hover)'
  primary-soft: 'var(--accent-soft)'
  ground: 'var(--background)'
  surface: 'var(--surface)'
  surface-raised: 'var(--surface-raised)'
  foreground: 'var(--foreground)'
  muted: 'var(--muted)'
  border: 'var(--border)'
  success: 'var(--success)'
  success-soft: 'var(--success-soft)'
typography:
  page-title:
    fontFamily: 'var(--font-cairo), sans-serif'
    fontSize: '26px'
    fontWeight: 700
    lineHeight: 1.6
  detail-title:
    fontFamily: 'var(--font-cairo), sans-serif'
    fontSize: '22px'
    fontWeight: 700
    lineHeight: 1.6
  action-title:
    fontFamily: 'var(--font-cairo), sans-serif'
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: 'var(--font-cairo), sans-serif'
    fontSize: '14px'
    lineHeight: 1.75
  label:
    fontFamily: 'var(--font-cairo), sans-serif'
    fontSize: '14px'
    fontWeight: 600
    lineHeight: 1.5
rounded:
  surface: '12px'
  control: '8px'
spacing:
  control-gap: '12px'
  feedback-inset: '16px'
  content-inset: '20px'
  group: '24px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '8px 15px'
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '8px 15px'
  confirmation:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.surface}'
    padding: '24px 20px'
  action-success:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.success}'
    rounded: '{rounded.surface}'
    padding: '20px'
---

# Porta Driver trip actions design

## Overview

Mode: **Operate**. This scoped record describes the built Driver trip-action extension on 2026-09-14 (Africa/Tripoli). An authenticated Arabic-speaking driver reads a trip's route and current state, selects an operation returned by the service, confirms it deliberately, and reviews authoritative feedback.

The extension preserves the incumbent [Porta design system](../DESIGN.md) and [Driver interface](DRIVER-INTERFACE-DESIGN.md): Cairo, Arabic RTL, restrained teal, light/dark neutral surfaces, thin borders, and generous touch controls. It introduces no new visual identity, composition image, raster asset, or decorative motion. The page keeps the existing Driver shell and places actions between trip identity and its scoped shipment list.

**Scoped supersession:** this document and the [trip-detail surface brief](../.impeccable/surfaces/src-features-driver-workspace-trip-detail-tsx.md) supersede the earlier statements that trip actions are unavailable or managed only by operations in `docs/DRIVER-INTERFACE-DESIGN.md` and `.impeccable/surfaces/src-features-driver-workspace-home-tsx.md`. That supersession applies only to the explicitly authorized trip actions described here. Root `PRODUCT.md`, root `DESIGN.md`, earlier surface briefs, and historical reports remain unchanged.

Built evidence comes from [trip actions](../src/features/driver-workspace/trip-actions.tsx), [display copy](../src/features/driver-workspace/trip-action-display.ts), [action state](../src/features/driver-workspace/trip-action-state.ts), [trip detail](../src/features/driver-workspace/trip-detail.tsx), and [workspace styles](../src/features/driver-workspace/driver-workspace.css). The global theme and Driver shell are inherited sources of visual truth. This record documents the implementation; it does not define service lifecycle rules.

### Evidence and limits

The final [visual manifest](../reports/driver-trip-actions/visual/results.json) reports **PASS for 50 measured states and no failures**. Ten states appear at each of five configurations: light 390, 430, 768 and 1440px, and dark 390px. The states are no action, START available, START pending, START success, stale 409, arrival available, completion available, completed, unavailable 404, and START confirmation. Three additional scrolled phone confirmation viewports bring the image set to **53 PNGs**.

The independent [finish review](../reports/driver-trip-actions/visual/FINISH-REVIEW.md) opened every PNG and returned **`ship`**, with no material presentation fixes. The supplied measurements report zero axe violations, horizontal overflow, undersized targets, or primary controls below 48px. Every state reports RTL, its expected theme, reduced motion, no running animations, no admin chrome, no raw error display, and no private data persisted. Each scrolled confirmation record reports zero buttons below bottom navigation. The single [mechanical detector result](../reports/driver-trip-actions/design-detector.json) is `[]`.

This documentation pass sampled the built source and three representative final images; the exhaustive visual inspection belongs to the finish reviewer. Neither the capture matrix nor the detector was rerun for documentation. Full-page phone captures retain fixed navigation at the initial viewport fold. The three separately scrolled images establish that the complete confirmation and its controls can sit above navigation; they do not imply that a whole document fits in one phone viewport.

Five proof boundaries remain explicit:

1. **Live integration:** these are intercepted synthetic Chromium session/read/action responses, including bounded synthetic START requests. Unexpected API and external requests are blocked. No live account, production data, real mutation, shipment cascade, or deployment acceptance is established.
2. **Physical devices:** browser viewport dimensions do not establish device ergonomics, software-keyboard behavior, or field use on real phones.
3. **Manual screen readers:** automated accessibility checks and semantic source inspection do not establish spoken output or complete accessibility conformance.
4. **Keyboard and time-dependent behavior:** still images do not establish focus movement, Escape, duplicate prevention, retries, race handling, or announcement timing. Those belong to separate [browser scenarios](../tests/e2e/driver-trip-actions.spec.ts) and [action interaction tests](../tests/unit/driver-trip-action-ui.test.tsx). Arrival and completion availability are captured; their confirmation/success interactions are source/test scope rather than additional screenshot coverage.
5. **Performance and engineering acceptance:** field performance, latency/SLA, live acceptance, and final regression gates are reported separately. The visual `ship` disposition makes none of those claims.

## Colors

The frontmatter references the live custom properties in [globals.css](../src/app/globals.css), so the existing light/dark theme remains the source of truth. It establishes no second palette. Teal identifies actionable choices and current status; neutral raised surfaces carry safe explanatory feedback. Green success tokens identify a server-confirmed result. Status and feedback always carry Arabic text.

**The State Has Words Rule.** Preserve the current Arabic status, named action, and explicit result text. Color supports those distinctions and never substitutes for them.

## Typography

Cairo remains the only interface family. The small hierarchy in the frontmatter separates page title, trip route, action heading, readable body copy, and labelled controls. Trip metadata labels are quiet (12px); secondary guidance is subdued (13px). The route repeated inside confirmation is body-sized with bold emphasis (700 weight), preserving the distinction between identifying the trip and explaining the action.

Arabic text flows RTL and wraps inside its container. Request references are isolated LTR with `bdi`. Departure values reuse the shared **Africa/Tripoli** formatter, matching the page's Libya-time explanation. The extension adds no letter-spaced Arabic, display typography, or decorative text treatment.

## Layout

The page order is return navigation, page heading and time context, trip status/route/metadata, action area, read feedback/refresh, then trip shipments. The detail remains visible above inline confirmation. The inherited shell caps content at 1040px, uses 20px phone inline padding, and reserves `92px + env(safe-area-inset-bottom)` below phone content for fixed navigation.

Actions occupy the normal document flow. Available choices form a vertical full-width stack with the control gap in the frontmatter. The shared action-area rule yields 24px block margins. Confirmation repeats the trip route, departure and current status before explaining the selected operation. Confirm and return stack on phones; at 768px and above they share a row with equal flex widths. The inherited navigation becomes a static top row at the same breakpoint and main padding becomes 32px.

Primary, confirm, return and review buttons retain a **48px minimum height**, with text wrapping permitted. The return-to-trips link retains its 44px minimum. Two wrapping metadata columns remain in the trip card on phones. Detail padding grows to 28px at the wider breakpoint; confirmation retains its established inset.

**The Context Before Commitment Rule.** Keep route, departure, current state, and the requested operation readable before the confirming control. Confirmation stays in the same document flow as the trip it affects.

## Elevation & Depth

Flat surfaces, a thin border and spacing separate detail and confirmation from the neutral page ground. Success uses a tonal surface; errors use a quiet raised surface. This extension adds no shadow, modal overlay, glass layer, celebratory effect, or floating action control. The existing fixed phone navigation is supported by reserved page space and the scrolled capture evidence.

## Shapes

Confirmation, detail and feedback use the existing gently rounded surface form. Buttons use the smaller control radius. Borders remain one pixel. This is the same Driver component language used elsewhere in the workspace; no trip-specific shape or icon system is introduced.

## Components

### Available trip actions

Availability comes **solely from the generated response metadata `meta.allowed_actions`**. The display module supplies Arabic copy and stable presentation order; it does not infer permission from trip status, shipment status/counts, role names, or a frontend transition graph. Every supplied supported action can render in this order:

| Contract action   | Choice label | Confirm label           | Authoritative success label |
| ----------------- | ------------ | ----------------------- | --------------------------- |
| `START`           | بدء الرحلة   | تأكيد بدء الرحلة        | تم بدء الرحلة بنجاح.        |
| `CONFIRM_ARRIVAL` | تأكيد الوصول | تأكيد الوصول إلى الوجهة | تم تأكيد وصول الرحلة.       |
| `COMPLETE`        | إكمال الرحلة | تأكيد إكمال الرحلة      | تم إكمال الرحلة بنجاح.      |

An empty action list produces the quiet text **لا توجد إجراءات متاحة حاليًا.** Details, navigation and supported reads remain useful. A completed trip is not assigned an action by local inference. Unknown or unavailable work is handled through the existing safe read states.

**The Metadata Is Authority Rule.** Only returned allowed-action metadata opens a choice. Backend validation remains decisive when the operation is submitted.

### Deliberate inline confirmation

Selecting a choice replaces the choice stack with an inline confirmation. Its heading names the action. Route, formatted departure and current status identify the trip, followed by the shipped explanation:

| Action            | Confirmation explanation                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `START`           | أنت على وشك بدء هذه الرحلة. سيتم اعتماد الحالة الجديدة من الخادم وتحديث الشحنات المرتبطة وفق قواعد التشغيل. |
| `CONFIRM_ARRIVAL` | أنت على وشك تأكيد وصول الرحلة. سيتم تحديث حالة الرحلة والشحنات المرتبطة من الخادم.                          |
| `COMPLETE`        | أنت على وشك إكمال الرحلة. لن يتيح الخادم هذا الإجراء إلا بعد استيفاء شروط الإكمال.                          |

These explanations defer completion conditions and linked shipment updates to the service. They do not enumerate, reproduce, or expand its business rules.

Source intent moves focus to the confirmation heading without scrolling. **رجوع** or Escape inside the confirmation cancels an unsubmitted selection and returns focus to its initiating choice. This is an inline section with ordinary document navigation, not a dialog focus trap. Replacing the detail snapshot invalidates a previously opened unsubmitted confirmation. The current authoritative metadata is checked again before starting an attempt.

### Pending, success and recovery

Pending uses **جارٍ تأكيد الإجراء**, disables submission, and exposes a status announcement. An in-flight attempt does not expose a cancel control that could imply the service request was undone. Reads in progress also disable the committing controls.

Success is shown only after a valid authoritative action response. The green result names the completed action, announces status, and receives focus at its heading. The action area stays blocked while a separate trip read checks current allowed actions; during that check the result explains **جارٍ التحقق من الإجراءات المتاحة للرحلة.** Linked reads refresh through the existing Driver state layer. The frontend does not locally calculate a shipment cascade or show optimistic success.

| State             | Implemented presentation and recovery                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uncertain outcome | Safe error plus **لم يصل تأكيد نهائي للإجراء. إعادة المحاولة تتحقق من الطلب نفسه.** The retained action offers **إعادة المحاولة**, reusing the same logical request identity. Alternative actions remain blocked. |
| 409 conflict      | **تم تحديث حالة الرحلة. يرجى مراجعة البيانات الحالية.** The attempt is cleared and authoritative trip/dependent reads refresh. The review notice remains available with refreshed context.                        |
| Review read fails | Action choices stay blocked; **تحديث الرحلة للمراجعة** offers a deliberate retry of the read.                                                                                                                     |
| 422 rejection     | **تعذّر قبول إجراء الرحلة. حدّث البيانات ثم حاول مجددًا.** The rejected attempt and confirmation are cleared; a new deliberate confirmation is needed before another action.                                      |
| Retry-After       | A readable seconds countdown disables retry until permitted; expiry never submits automatically. The retained deadline survives navigation within the in-memory session.                                          |
| 401 / 403 / 404   | Existing authentication/resource-revocation handling removes access to protected work. The captured 404 removes the trip detail, action area and shipment list.                                                   |

Request references appear only when supplied, subordinate to safe Arabic feedback. Logical attempts remain in Driver query memory across navigation and are removed with session cleanup. There is no persistent private cache, background mutation retry, offline queue, or silent overwrite.

### Focus, contrast and motion

Controls inherit the visible teal focus outline (2px, 4px offset) and short global color/background transition (150ms). Disabled buttons use the existing reduced opacity and unavailable cursor. Success and pending use status announcements; errors use alerts. The shell's reduced-motion rule removes transitions and animations from its descendants. The new action surface adds no authored animation.

## Do's and Don'ts

- **Do** preserve Cairo, RTL, light/dark tokens, clear Arabic status, and the dedicated Driver shell.
- **Do** preserve metadata-only availability, route/state context before confirmation, and 48px operational controls.
- **Do** keep safe error text, deliberate retry, authoritative success, and current action metadata together.
- **Do** keep synthetic capture evidence, interaction evidence, live acceptance, and performance findings at their actual scope.
- **Don't** derive actions from status/counts, invent lifecycle edges, or duplicate backend completion/cascade rules.
- **Don't** add admin data, GPS/maps, scanning, proof of delivery, PWA behavior, offline writes, or persistent customer storage as implied extensions.
- **Don't** interpret a visual `ship` disposition as deployment approval or live mutation acceptance.

No presentation defect was canonized as a system rule. The superseded trip-action prohibition and fixture-specific state sequence remain historical/evidence context rather than guidance for future implementations.
