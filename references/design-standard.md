# Operational UI Design Standard

Use this standard for generated page prototypes and the review workbench. It targets internal systems, workflow tools, and data-heavy operational products.

## Template Sources

- `assets/project-template/shared/design-system.css`: portable tokens and reusable controls.
- `assets/project-template/shared/shell.css`: application chrome and responsive page layout.
- `assets/project-template/page/`: source files copied for every new page.
- `assets/workbench/`: the generated specification and traceability workbench.

Change shared foundations in these assets, not in the CLI. Project-specific adaptations belong in the generated project's `shared/` files.

## Page Anatomy

Every operational page uses this reading order:

1. Product or module header with environment state.
2. Stable navigation region.
3. Breadcrumb and compact page heading.
4. Primary actions aligned with the heading.
5. Optional summary metrics when they aid decisions.
6. Filters immediately before the data or workflow surface.
7. Main table, form, board, or process surface.
8. Visible empty, loading, blocked, validation, success, and failure states where applicable.

Do not add marketing heroes, decorative page-section cards, nested cards, oversized headings, or explanatory feature copy.

## Visual Rules

- Use the CSS custom properties prefixed `--vpw-`; do not introduce a second token set inside a page.
- Keep panel radius at 6px or less and control radius at 4px.
- Use white surfaces, neutral gray structure, green primary actions, blue information, amber warnings, and red failures. Do not recolor the whole interface into one hue family.
- Use 24px page titles, 16px section titles, 14px body text, and 11-12px metadata. Font sizes do not scale with viewport width.
- Keep tables stable with explicit columns, tabular numeric values, overflow behavior, and a defined empty state.
- Use icon-only controls only for familiar actions and always provide an accessible name and tooltip. Use text buttons for explicit workflow commands.
- Prefer full-width bands and bordered tools. Cards are reserved for repeated entities or genuinely framed tools.

## Interaction Rules

- A primary command must expose success, rejection, disabled, and in-progress behavior when those states exist in the requirement.
- Filters must be resettable and must not shift surrounding layout when results change.
- Keyboard focus remains visible; controls have semantic labels; status messages use an appropriate live region.
- At mobile widths, navigation becomes a drawer or collapses, action groups wrap, metrics stack, and wide tables scroll without clipping the page.
- Prototype fixtures must contain at least one happy-path record and one meaningful boundary or blocked record.

## Completion Check

A prototype is visually complete only when the standalone output has been inspected at desktop and mobile widths, primary and rejection paths work, no text overlaps or overflows its control, and the workbench can preview both documents and the evidence table.
