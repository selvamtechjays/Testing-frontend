<!-- delivery-os:code-context -->

## Code context

This repo has a context graph. `context/code-context/code-context-index.md` is the entry point.

Resolve any page, endpoint or database object through **layer index → the matching row → that unit
file** — two reads. Do not grep the repo for a surface the index already names.

Units carry `implementation_state`: `Implemented` is as-built, `Planned` is not written yet.
<!-- /delivery-os:code-context -->

<!-- delivery-os:ui-system -->

## UI system

The UI standard is `.jetrix/shared-context/ui-standards.md` — direction, token scales, the
measured contrast table, primitives, and rules `CSS-FE-001..010`. **Read it before writing or
changing a screen.**

Tokens: `src/index.css` `:root`. Primitives: `src/components/`. Styling is plain CSS with custom
properties — no component library, and no new styling dependency without a `DEC-###`.

Every visual value comes from a token. No raw hex, no px font sizes, no magic spacing, no inline
transitions. Check `src/components/` before writing a component; the second use of an element is
what makes it shared, not the third.
<!-- /delivery-os:ui-system -->

## Tests

Coverage per feature lives in `context/test-map/<feature-slug>.md`. Each row is a
scenario with the exact command to run it on its own, what it needs running, and
which fixtures it uses. Read the map before writing a new test — the fixture you
need probably exists.
