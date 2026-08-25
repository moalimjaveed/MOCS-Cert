# MOCS-Cert Scientific Workstation Design System Specification

## 1. Executive Summary & Design Vision

MOCS-Cert (Molecular Observability Compiler for Certified Query Execution) is professional scientific workstation software designed for computational structural biologists, biophysicists, and simulation engineers. Its visual identity communicates:

- **Mathematical and deductive rigor**: Every visual element corresponds to a verified semantic state or proof obligation.
- **High information density with minimal decorative overhead**: Data, coordinate lineages, interval bounds, and verification certificates are presented cleanly without artificial pagination, nested cards, or ornamental borders.
- **Visual calmness**: Zero eye fatigue during multi-hour trajectory screening sessions; strictly neutral solid surfaces (`#FFFFFF` on `#F3F3F3`) with intentional high-contrast epistemic color assertions.

---

## 2. Epistemic Proof & Deductive Truth Color Canon

In MOCS-Cert, color is not aesthetic decoration. Color is a formal mathematical assertion of Kleene 3-valued proof state:

| Epistemic State | Color Token | Hex Code | Visual Semantic Meaning |
|:---|:---|:---|:---|
| **TRUE / CERTIFIED_TRUE** | Cobalt Blue | `#0969DA` | Deductively proven; certified sound predicate over interval. |
| **FALSE / CERTIFIED_FALSE** | System Red / Rose | `#C42B1C` | Refuted predicate; violation witness identified. |
| **UNKNOWN / NEEDS_REFINEMENT** | Amber / Gold | `#B45309` | Inconclusive under current AABB bound; requires coordinate refinement or exact frame sampling. |
| **UNRESOLVABLE_SAMPLING** | Royal Violet | `#6D28D9` | Query cannot be resolved under trajectory sampling interval $\Delta t$ or unsupported semantics. |
| **Measurement Caliper A** | Royal Blue | `#005FB8` | First atom anchor in Euclidean distance measurement (Target). |
| **Measurement Caliper B** | Amber / Crimson | `#D97706` / `#E11D48` | Second atom anchor in Euclidean distance measurement (Partner/Ligand). |
| **Primary Interaction** | Fluent Accent | `#005FB8` | Interactive action buttons, active tab indicators, and focus rings. |

> **Strict Non-Compete Rule**: Brand accents and interactive highlights must NEVER use `#0969DA`, `#B45309`, or `#C42B1C` for unverified or neutral controls.

---

## 3. Surface & Elevation Hierarchy (Levels 0 – 4)

Visual grouping is accomplished through semantic surfaces and whitespace rather than nesting cards within cards.

```
Level 0: Window Background (#F3F3F3)
   └── Level 1: Primary Section Container (#FFFFFF, 1px #E5E5E5, R=6-8px)
         └── Level 2: Content Region / Metric Strip / Subpanel (#F8FAFC, 1px #E2E8F0, R=4-6px)
               └── Level 3: Interactive Controls (#FFFFFF, border #D1D1D1, hover #F8FAFC)
                     └── Level 4: Temporary Overlays & Modals (#FFFFFF, border #D1D1D1, shadow-lg)
```

- **Level 0 (Window Canvas)**: Neutral solid `#F3F3F3`. Never contains borders or shadows.
- **Level 1 (Primary Workstation Section)**: Pure `#FFFFFF` with subtle structural boundary (`1px solid #E5E5E5`). Radius: `6px` or `8px`.
- **Level 2 (Secondary Content Area / Metric Strip)**: Subtle neutral `#F8FAFC` or `#FAFAFA` with light boundary (`1px solid #E2E8F0`).
- **Level 3 (Interactive Controls & Inputs)**: Solid `#FFFFFF`, `1px solid #D1D1D1` or `#E5E5E5`, hover `#F8FAFC`, active `#005FB8`. Radius: `4px`.
- **Level 4 (Floating Dialogs, Modals, Menus)**: Solid `#FFFFFF`, `1px solid #CBD5E1`, elevated shadow (`shadow-md` or `shadow-lg`).

---

## 4. The Card-in-Card Elimination Rule

Scientific workstations do not use cards inside cards. The DOM hierarchy follows:

$$\text{PAGE} \longrightarrow \text{SECTION} \longrightarrow \text{CONTENT}$$

- **Forbidden**: `Card` containing a `Card` containing a `Card`.
- **Permitted**: A Section (`surface-1`) containing a clean table, a code editor, a 3D canvas, or a horizontal metric strip.
- Grouping inside a section is performed via:
  1. Typographic hierarchy (caption, body, subtitle, title).
  2. Aligned column grids and definition rows.
  3. Subtle vertical or horizontal dividers (`#F1F5F9` or `#EEEEEE`).

---

## 5. Horizontal Metric Strip Protocol (Zero Label Wrapping)

To prevent the two- and three-line label wrapping problem (`WALL EXECUTION TIME`, `I/O PRUNE RATIO`, `PEAK WORKSTATION RAM`, `CERTIFICATE DIGEST`, `DEDUCTIVE SOUNDNESS`):

- **Format**: All high-level telemetry groups are laid out as a unified **Horizontal Metric Strip** (`.mocs-metric-strip`).
- **Label Properties**:
  - `font-size: 11px` or `11.5px`
  - `font-weight: 600`
  - `text-transform: uppercase`
  - `letter-spacing: 0.04em`
  - `white-space: nowrap` (strictly single line, zero wrapping)
  - `color: #5C5C5C` (secondary neutral)
- **Value Properties**:
  - `font-size: 18px` to `20px`
  - `font-weight: 700`
  - `font-variant-numeric: tabular-nums`
  - `color: #1C1C1C`
- **Subtext / Lineage**:
  - `font-size: 11px`
  - `color: #5C5C5C` or semantic accent
  - `white-space: nowrap` / clean single-line context

---

## 6. Geometric Radius Hierarchy

All radii are calculated systematically:

$$R_{\text{inner}} = \max(0, R_{\text{outer}} - P)$$

| Role | Token | Radius |
|:---|:---|:---|
| Primary section container | `rounded-lg` / `rounded-[8px]` | 8px |
| Internal content block | `rounded-md` / `rounded-[6px]` | 6px |
| Interactive controls & buttons | `rounded-sm` / `rounded-[4px]` | 4px |
| Micro-tags & chips | `rounded-xs` / `rounded-[3px]` | 3px |
| Intentional circles (dots, spinners) | `rounded-full` | 9999px |

Arbitrary values (`rounded-[13px]`, `rounded-[17px]`, etc.) are prohibited.

---

## 7. Molecular Viewport & Overlay Rules

1. **Zero Collision with Scientific Description**: The structure title (`RCSB PDB · 4HHB · Hemoglobin A...`) and frame context are rendered in normal document flow inside the toolbar header. Absolute overlays must NEVER overlap this text under any viewport dimension.
2. **Docked Legend HUD**: The 3D biopolymer legend is docked cleanly with guaranteed canvas margin, collapsible via single click, and respects container bounds.
3. **Clean View Workspace Mode**: Toggling Clean View expands the 3D molecular canvas, cleanly collapses non-essential inspection chrome, and provides a clear, integrated toggle state in the toolbar. It never renders an arbitrary dark floating box.
4. **Interaction State Clarity**: Structure preset buttons (`4HHB`, `synth_500f`, `1BNA`, `1TUP`) and the `Explore...` button must have distinct unselected (`bg-white` or subtle, border `#E5E5E5`, text `#475569`) versus active (`bg-[#005FB8] text-white border-[#005FB8]`) states. An inactive button must NEVER visually look active.

---

## 8. Surface Opacity & Anti-Glassmorphism Rule

- **No Backdrop Blur**: `backdrop-blur-*` is prohibited on scientific panels.
- **Solid Surfaces**: All containers have `1.0` alpha opacity fills.
- **High Contrast**: Text contrast ratios must exceed 4.5:1 for body copy and 3.0:1 for large headings (WCAG AA compliant).
