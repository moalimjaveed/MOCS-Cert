# TECH_STACK.md — MOCS-Cert UI/UX Technology Master Specification

> **Authoritative Specification: Frontend Architecture, Curated Tech Stack & Visualization Engines**
>
> This document defines **WHAT** the MOCS-Cert Observability Studio uses: packages, rendering pipelines, state architecture, visualization engines, layout structures, proof tracing workflows, and design tokens.
>
> For the visual and design philosophy (**WHY**), refer to [`RULE.md`](./RULE.md), which serves as the binding visual constitution.

---

# 1. Executive Summary & Architectural Philosophy

When building software for computational biophysicists and structural biologists, adding dozens of flashy UI packages creates fragile, unmaintainable bloat. What separates amateur dashboards from a **world-class scientific research workstation** is:

1. **A Coherent Visual Hierarchy**: Dense, technical, restrained, dark-mode first.
2. **Deterministic Color Semantics**: Every hue tied directly to epistemic truth and deductive proof states (Emerald for `TRUE`, Rose for `FALSE`, Amber for `UNKNOWN`, Purple for `UNRESOLVABLE`, Cyan/Orange for selection AABBs).
3. **Engineered Rendering Separation**: UI in DOM $\to$ Timeline in Canvas/D3 $\to$ 3D Molecules & AABBs in WebGL/Mol*.
4. **Interactive Deductive Traceability**: The **Proof Mode** linking Claim $\to$ Evidence $\to$ Interval $\to$ Block $\to$ 3D AABB.
5. **High-Throughput Streaming**: Web Worker ring buffer + 60 fps `requestAnimationFrame` batching to prevent React re-render cascades.

---

# 2. Curated Technology Stack Overview

```text
MOCS-CERT OBSERVABILITY STUDIO
│
├── FRONTEND CORE
│   ├── React 18/19 + TypeScript 5.x
│   ├── Vite 5.x (Build & HMR)
│   ├── Tailwind CSS 3.4+
│   ├── Radix UI (Headless primitives)
│   ├── shadcn/ui (Composed design system)
│   ├── Zustand 4.5+ (Client/UI state slices)
│   ├── TanStack Query v5 (Server/API state)
│   ├── React Hook Form + Zod (Validation)
│   └── Motion for React 11.x (UI micro-interactions)
│
├── VISUALIZATION ENGINES
│   ├── Mol* v4.x                → Primary molecular structure & cartoon viewer
│   ├── D3.js v7.x               → Custom temporal intervals & block lattice
│   ├── HTML5 Canvas + Offscreen → High-density frame/block rendering
│   ├── Three.js / R3F           → Custom 3D AABB wireframe cages & distance calipers
│   └── WebGL / WebGPU           → Heavy spatial acceleration
│
├── DATA / INSPECTION / DSL
│   ├── TanStack Table v8        → Headless evidence & block data grid
│   ├── React Virtuoso v4        → Virtualized rendering for 1M+ frames/events
│   ├── Monaco Editor v0.47+     → MolQL-Cert DSL editor with AST diagnostics
│   ├── Sonner                   → High-density scientific toast notifications
│   └── cmdk                     → Global Command Palette (⌘K)
│
├── REAL-TIME & STREAMING
│   ├── WebSocket / SSE          → High-frequency block evaluation events
│   ├── Web Workers              → Off-main-thread parsing & spatial calculations
│   └── Event Ring Buffer        → rAF batching (60 fps flush to Zustand)
│
├── BACKEND SERVICES & NUMERICAL ACCELERATION
│   ├── FastAPI                  → Asynchronous REST + WebSocket API
│   ├── Python 3.11+ / 3.12      → Core compiler, MDAnalysis
│   ├── Mixed Array Engine       → Hybrid JAX + NumPy + CuPy numerical acceleration
│   │   ├── NumPy                → CPU baseline, MDAnalysis interop, zero-copy buffer handoffs
│   │   ├── CuPy                 → GPU-accelerated batch AABB bounding & massive coordinate streams
│   │   └── JAX                  → XLA JIT-compiled fused kernels & vectorized interval reductions
│   ├── Pydantic v2              → Schema validation & serialization
│   └── Background Workers       → Multi-threaded dyadic tree descent
│
└── RESEARCH & PROTOTYPING
    ├── JupyterLab               → Interactive notebook analysis
    ├── ipymolstar / py3Dmol     → Inline notebook molecular visualization
    └── Streamlit                → Rapid prototype dashboards
```

---

# 3. The 14 Foundational Architectural Decisions

### 1. shadcn/ui as the Core Component System
* **Verdict**: ⭐ **CORE**
* **Rationale**: Uses Radix UI primitives with Tailwind styling. Components are owned in the repository (`src/components/ui/`), not locked inside an immutable node module. Provides Button, Dialog, Drawer, Tabs, Tooltip, Popover, Dropdown, Select, Command, Sidebar, Sheet, Table, Badge, Card, Input, Menus, and Resizable Panels.
* **Rule**: *Radix = primitives. shadcn = beautifully composed primitives.*

### 2. Zustand for Predictable Client State
* **Verdict**: ⭐ **CORE**
* **Rationale**: Trajectory analysis involves complex shared state (selected molecule, active block, current timestep, visible AABBs, pruned blocks, proof status, timeline cursor, camera matrix). Zustand slices isolate updates without re-render cascades:
  * `useScanStore`: Trajectory metadata, active scan progress, prune rate.
  * `useViewerStore`: 3D camera matrices, AABB visibility toggles, representations.
  * `useTimelineStore`: Playhead frame $k$, active block $m$, zoom level.
  * `useEvidenceStore`: Witness blocks list, coordinate inspection status.
  * `useProofStore`: Certificate JSON, deductive claim DAG, audit status.
  * `useUIStore`: Active panel splitters, command palette open state, theme.

### 3. TanStack Query for Server State Separation
* **Verdict**: ⭐ **CORE**
* **Rationale**: Clean separation of state concerns:
  $$\text{Zustand (Client State)} \longleftrightarrow \text{TanStack Query (Server Cache)} \longleftrightarrow \text{WebSocket (Real-Time Ingestion)}$$

### 4. Zod for Strict Scientific Schema Validation
* **Verdict**: ⭐ **CORE**
* **Rationale**: Scientific data and machine certificates must never silently fail in the frontend. Zod validates FastAPI responses against the official JSON Schema (Draft 2020-12):
  $$\text{FastAPI / Pydantic} \longrightarrow \text{JSON} \longrightarrow \text{Zod Schema} \longrightarrow \text{Typed Models}$$

### 5. Specialized Separation: Mol* + Three.js + D3 (Not D3 for Everything)
* **Verdict**: ⭐ **CORE ENGINES**
* **Rationale**: Do not turn the entire application into a D3 monolith or attempt molecular rendering in Three.js from scratch:
  * **Mol***: Biopolymer structures (PDB, GRO, mmCIF), secondary structures, selections.
  * **Three.js / WebGL Layer**: Semi-transparent AABB bounding boxes, centroid-to-centroid calipers, minimum-image PBC vectors.
  * **D3.js + HTML5 Canvas**: Block partition grid ($b=100$), half-open interval $[k_s, k_e)$ scrubber, dyadic tree hierarchy.

### 6. Global Command Palette (`cmdk`)
* **Verdict**: ⭐ **CORE**
* **Rationale**: Scientific applications require rapid keyboard navigation via `⌘K` / `Ctrl+K`:
  * `Jump to Residue <id>` (e.g., `A:155`) $\to$ recenters 3D viewport.
  * `Run Query` $\to$ compiles active MolQL AST and starts execution.
  * `Filter Timeline: Pruned Only` $\to$ isolates skipped blocks.
  * `Audit Certificate` $\to$ triggers offline cryptographic hash and witness verification.
  * `Export Certificate (.json)` $\to$ downloads verifiable execution certificate.

### 7. Three-Pane Workstation Architecture
* **Verdict**: ⭐ **CORE LAYOUT**
* **Rationale**: High-density scientific instrument layout with `react-resizable-panels`:
  * **Panel A (Left, 22–30%)**: Explorer, Atom Selection Manager, MolQL Editor, Cost Optimizer Card.
  * **Panel B (Center, 45–55%)**: 3D Molecular Graphics (Mol* + Three.js AABBs) + Temporal Lattice Timeline.
  * **Panel C (Right, 22–30%)**: Evidence Inspector, Proof Trace DAG, Machine Certificate Auditor.

### 8. Machine Proof Mode: Deductive Traceability
* **Verdict**: ⭐ **KILLER DIFFERENTIATING FEATURE**
* **Rationale**: The UI toggles between **Exploration Mode** (for human biophysicists) and **Proof Mode** (for formal audit). Clicking any claim interactively traces:
  $$\text{Claim} \longrightarrow \text{Evidence Witness} \longrightarrow \text{Event Interval } [k_s, k_e) \longrightarrow \text{Block } m \longrightarrow \text{3D AABB Region} \longrightarrow \text{Soundness } \checkmark$$
  Synchronizes Mol* camera, WebGL bounding boxes, and the Canvas playhead to the exact frame window.

### 9. Monaco Editor with MolQL Scientific Tooling
* **Verdict**: ⭐ **CORE DSL STUDIO**
* **Rationale**: Monaco provides VS Code-level language features for MolQL-Cert:
  * Real-time grammar syntax highlighting.
  * Static diagnostics (cardinality $|ag| \neq 1$, unsupported operators).
  * Hover definitions for coordinate metrics and temporal intervals.
  * Dual-pane toggle: MolQL DSL $\longleftrightarrow$ Compiled Certificate JSON.

### 10. Virtualization: TanStack Table + React Virtuoso
* **Verdict**: ⭐ **MANDATORY PERFORMANCE GUARANTEE**
* **Rationale**: A $1\,\mu\text{s}$ trajectory contains 100,000 frames and up to $10^6$ coordinate evaluations. Rendering millions of elements in the DOM will crash the browser. Virtualization renders only the visible ~30 rows in the DOM at any instant.

### 11. Strict Scientific Design Tokens
* **Verdict**: ⭐ **CORE DESIGN SYSTEM**
* **Rationale**: Governed by [`RULE.md`](./RULE.md). Dense, technical, dark-mode first (`#020617` / `#080A0E`). All colors tied to epistemic truth.

### 12. Keyboard-First UX Protocol
* **Verdict**: ⭐ **CORE INTERACTION**
* **Rationale**: Full keyboard control: `Space` (play/pause), `←`/`→` (step frame), `Shift+←`/`→` (step block), `P` (toggle Proof Mode), `B` (toggle AABB cages), `R` (recenter camera), `⌘K` (command launcher).

### 13. Python 3.11+ / 3.12 Backend Baseline
* **Verdict**: ⭐ **CORE INFRASTRUCTURE**
* **Rationale**: Python 3.11+ delivers 10–60% speedups, improved typing syntax (`TypeVarTuple`, `Self`), and native compatibility with high-performance NumPy/MDAnalysis pipelines.

### 14. In-App System Observability
* **Verdict**: ⭐ **DIAGNOSTIC INSTRUMENTATION**
* **Rationale**: The studio monitors its own performance: WebSocket round-trip latency, block evaluation throughput, I/O prune rate meter, memory footprint, and verifier audit checks.

### 15. Mixed Array Computing: JAX + NumPy + CuPy (Not NumPy Alone)
* **Verdict**: ⭐ **CORE NUMERICAL ENGINE**
* **Rationale**: Trajectory analysis must not rely on single-threaded CPU NumPy alone. MOCS-Cert implements a tri-array hardware-adaptive execution model:
  * **NumPy**: Baseline CPU array manipulation, zero-copy pointer exchanges with MDAnalysis C-readers, and universal fallback on standard hosts.
  * **CuPy**: NVIDIA CUDA & AMD ROCm GPU array acceleration. Provides drop-in GPU arrays for batch AABB bounding box construction over millions of frames, parallel minimum-image PBC wrapping, and multi-atom distance evaluations ($>100\times$ faster on dense frames).
  * **JAX**: Just-in-time compilation via OpenXLA (jax.jit), automatic vectorization (jax.vmap), and differentiable biophysical geometry. Fuses multi-step spatial coordinate reductions into single memory-pass GPU/CPU kernels, eliminating intermediate buffer allocations.
  * **Hybrid Dispatcher (mocs.arrays)**: Automatically selects the fastest available backend:
    \\text{CUDA/ROCm GPU} \\longrightarrow \\text{CuPy / JAX GPU} \\longrightarrow \\text{JAX CPU (XLA)} \\longrightarrow \\text{NumPy (Host CPU)}

---

# 4. The 40-Technology Master Evaluation Matrix

| # | Technology | Package Name | Primary Role | Verdict | MOCS-Cert Usage Strategy |
|:---:|:---|:---|:---|:---:|:---|
| 1 | **shadcn/ui** | `shadcn-ui` | Core Component System | ⭐ **CORE** | Base for buttons, dialogs, tabs, panels, dropdowns, tables. |
| 2 | **Radix UI** | `@radix-ui/react-*` | Headless Primitives | ⭐ **CORE** | Accessible state primitives underlying shadcn. |
| 3 | **Motion for React** | `motion` | React UI Animation | ⭐ **CORE** | Panel transitions, selection states, timeline cursor, inspector. |
| 4 | **Anime.js** | `animejs` | DOM/SVG Animation | ⚙️ **SPECIALIZED** | Reserved for custom SVG vector path animations if needed. |
| 5 | **GSAP** | `gsap` | Complex Timeline Sequences | ⚙️ **OPTIONAL** | Optional power tool for multi-stage scientific presentation demos. |
| 6 | **Lenis** | `lenis` | Smooth Scrolling | 🌐 **LANDING ONLY** | Marketing / landing page only; disabled in workstation panels. |
| 7 | **React Bits** | — | Animated Components | 💡 **INSPIRATION** | Catalog reference for micro-interactions; never blindly cloned. |
| 8 | **Magic UI** | `magicui` | Animated Backgrounds | 💡 **OPTIONAL** | Documentation and research paper landing pages. |
| 9 | **Aceternity UI** | — | Flashy Visual Effects | ⚠️ **AVOID WORKSTATION** | Avoid in studio; too ornamental for dense research software. |
| 10 | **Motion Primitives** | `motion-primitives` | Animated Tailwind Patterns | ⭐ **RECOMMENDED** | Clean, accessible micro-interaction patterns. |
| 11 | **Zustand** | `zustand` | Client State Management | ⭐ **CORE** | Five isolated slices (`scan`, `viewer`, `timeline`, `proof`, `ui`). |
| 12 | **React Spring** | `@react-spring/web` | Physics Animation | ⚙️ **OPTIONAL** | Motion covers our needs; do not mix physics engines initially. |
| 13 | **React Three Fiber** | `@react-three/fiber` | Declarative 3D Canvas | ⭐ **HIGHLY RECOMMENDED** | Renders custom WebGL layers over Mol* molecular views. |
| 14 | **Three.js** | `three` | WebGL 3D Engine | ⭐ **CORE 3D** | AABB bounding boxes, centroid-to-centroid calipers, PBC vectors. |
| 15 | **Drei** | `@react-three/drei` | R3F Helpers | ⭐ **RECOMMENDED** | Cameras, orbit controls, line geometries, HTML overlays. |
| 16 | **React Postprocessing** | `@react-three/postprocessing` | Shader Effects | ⚙️ **OPTIONAL** | Subtle AABB selection glow; zero cartoonish over-bloom. |
| 17 | **use-gesture** | `@use-gesture/react` | Gestures & Pinch/Zoom | ⭐ **RECOMMENDED** | Timeline scrubbing, canvas zoom, 3D caliper measurement dragging. |
| 18 | **Monaco Editor** | `monaco-editor` | DSL Code Editor | ⭐ **CORE** | MolQL-Cert query editor with AST error markers & schema hover. |
| 19 | **TanStack Table** | `@tanstack/react-table` | Headless Data Grid | ⭐ **CORE** | Evidence lists, frame tables, candidate plan cost matrices. |
| 20 | **React Virtuoso** | `react-virtuoso` | DOM Virtualization | ⭐ **CORE** | Virtualizes 100k+ frames and 1M+ evidence records at 60 fps. |
| 21 | **TanStack Virtual** | `@tanstack/react-virtual` | Virtualization Primitive | ⚙️ **ALTERNATIVE** | Fallback if custom table integration is required. |
| 22 | **Sonner** | `sonner` | Toast Notifications | ⭐ **CORE** | Non-intrusive scan status, certificate verification alerts. |
| 23 | **cmdk** | `cmdk` | Command Palette | ⭐ **CORE** | `⌘K` launcher for queries, residue jumps, and audit commands. |
| 24 | **Leva** | `leva` | Parameter GUI | 🔬 **DEBUG MODE** | Internal developer mode for tuning camera, AABB opacity, lighting. |
| 25 | **Iconify** | `@iconify/react` | Multi-set Icon Loader | ⚙️ **OPTIONAL** | Supplemental icon set for specialized biochemical symbols. |
| 26 | **Lucide React** | `lucide-react` | Primary Icon System | ⭐ **CORE** | Standardized 16px/18px icons across all workstation panels. |
| 27 | **NGL Viewer** | `ngl` | Molecular Graphics | ⚙️ **SPECIALIZED** | Alternative molecular loader; Mol* remains primary. |
| 28 | **Mol*** | `molstar` | Primary Molecular Viewer | ⭐ **CORE** | Standard molecular graphics engine for PDB, GRO, cartoon/licorice. |
| 29 | **D3.js** | `d3` | Custom Scientific Plots | ⭐ **CORE** | Interval graphs, dyadic block grids, scatter plots, time axes. |
| 30 | **Observable Plot** | `@observablehq/plot` | Statistical Visualization | 📊 **ANALYTICS** | MOBench benchmark analysis and speedup distributions. |
| 31 | **Apache ECharts** | `echarts` | High-Volume Charts | ⚙️ **OPTIONAL** | Optional if extreme time-series density is required. |
| 32 | **React Aria** | `react-aria` | Accessible Primitives | ⚙️ **OPTIONAL** | Accessibility layer; Radix/shadcn handles primary needs. |
| 33 | **Floating UI** | `@floating-ui/react` | Coordinate Positioning | ⚙️ **OPTIONAL** | Handled natively by Radix popover and tooltip primitives. |
| 34 | **React Resizable Panels** | `react-resizable-panels` | Split-Pane Layout | ⭐ **CORE** | Three-pane workstation layout with persistent draggable splitters. |
| 35 | **React Dropzone** | `react-dropzone` | Drag-and-Drop Files | ⚙️ **RECOMMENDED** | Ingesting external PDB/GRO/XTC files and JSON certificates. |
| 36 | **Lottie** | `lottie-react` | Vector Animation | ⚠️ **LOW PRIORITY** | Avoid in research studio; too decorative. |
| 37 | **Rive** | `@rive-app/react` | Interactive Vector Motion | 🌐 **LANDING ONLY** | Marketing and research paper showcase graphics only. |
| 38 | **WebGL / WebGPU** | — | Hardware Acceleration | ⭐ **CORE ENGINE** | GPU rendering for molecular geometry and spatial envelopes. |
| 39 | **Web Workers** | — | Background Concurrency | ⭐ **CORE ARCHITECTURE** | Off-main-thread WebSocket parsing, sorting, and interval mapping. |
| 40 | **OffscreenCanvas** | — | Background Canvas Render | 🚀 **SCALE OPTIMIZATION** | Headless canvas rendering inside Web Workers for massive grids. |

---

# 5. UI Component Sources Comparison

| Component System | Role | MOCS-Cert Recommendation | Integration Strategy |
|:---|:---|:---:|:---|
| **shadcn/ui** | Core UI System | ⭐⭐⭐⭐⭐ | Copy-paste primitives owned in `src/components/ui/`. |
| **Radix UI** | Accessible Primitives | ⭐⭐⭐⭐⭐ | Unstyled state machines underlying shadcn. |
| **Motion for React** | UI Animation | ⭐⭐⭐⭐⭐ | Layout, gesture, and exit animations for all interactive panels. |
| **Motion Primitives** | Animated Components | ⭐⭐⭐⭐ | Selective animated micro-components. |
| **React Bits** | Creative Patterns | ⭐⭐⭐ | Reference catalog for specialized visual interactions. |
| **Magic UI** | Background Effects | ⭐⭐⭐ | Selective use for documentation and research landing pages. |
| **Aceternity UI** | Marketing Effects | ⭐⭐ | Minimal use; avoid ornamental clutter in workstation panels. |
| **21st.dev** | Component Discovery | ⭐⭐⭐ | Visual discovery catalog for shadcn patterns. |
| **Origin UI** | Extended UI Patterns | ⭐⭐⭐ | Input and table pattern inspiration. |
| **MUI / Mantine / Chakra** | Locked-in Component Libraries | ⛔ **DO NOT COMBINE** | Do not mix monolithic runtime UI libraries. Stick to Tailwind + Radix. |

---

# 6. The Five Frontend Architecture Engines

```text
┌────────────────────────────────────────────────────────────────────────┐
│ MOCS-CERT FRONTEND ENGINES                                             │
├─────────────────┬──────────────────────────────────────────────────────┤
│ ① UI Engine     │ shadcn/ui + Radix + Tailwind + Lucide + Motion       │
│ ② 3D Engine     │ Mol* (Structures) + Three.js / WebGL (AABB Cages)    │
│ ③ Time Engine   │ D3.js + HTML5 Canvas + Web Workers                   │
│ ④ Data Engine   │ TanStack Table + React Virtuoso + Monaco Editor      │
│ ⑤ State Engine  │ Zustand + TanStack Query + Zod + WebSocket Buffer    │
└─────────────────┴──────────────────────────────────────────────────────┘
```

### Engine 1: UI & Component Engine
- **Stack**: `shadcn/ui` + `Radix UI` + `Tailwind CSS` + `Lucide React` + `Motion for React`
- **Responsibilities**: Workstation shell, modal overlays, atom selection manager pills, tab controls, tooltips, and micro-interactions.
- **Rules**: Governed strictly by [`RULE.md`](./RULE.md). No arbitrary radii; spring curves $\le 250\,\text{ms}$.

### Engine 2: 3D Molecular & Spatial Engine
- **Stack**: `Mol*` (production viewer) + `Three.js` / `R3F` (custom WebGL overlay)
- **Responsibilities**:
  1. Mol* renders primary biopolymer cartoon/licorice structure.
  2. Three.js renders semi-transparent AABB bounding boxes enclosing selection atoms over the active temporal block $[k_s, k_e)$.
  3. Interactive 3D distance caliper showing minimum-image Euclidean distance $[L, U]$ with dynamic threshold coloring.

### Engine 3: Temporal Interval & Block Lattice Engine
- **Stack**: `D3.js` + `HTML5 Canvas` + `Web Workers`
- **Responsibilities**:
  1. Renders 100,000+ frames organized into discrete blocks ($b=100$) in an interactive timeline.
  2. Color-coded blocks: Emerald (`TRUE`), Dark Rose (`PRUNED FALSE`), Amber (`REFINED LEAF`).
  3. Draggable playhead scrubber with sub-millisecond coordinate synchronization.

### Engine 4: Evidence & DSL Compiler Engine
- **Stack**: `TanStack Table` + `React Virtuoso` + `Monaco Editor` + `cmdk`
- **Responsibilities**:
  1. Virtualized evidence data grid capable of rendering 1,000,000+ witness records.
  2. Monaco Editor providing MolQL syntax highlighting, live AST diagnostics, and auto-completion.
  3. JSON Certificate viewer with copy/download and offline audit triggers.

### Engine 5: State & Real-Time Ingestion Engine
- **Stack**: `Zustand` (5 slices) + `TanStack Query` + `Zod` + WebSocket Event Ring Buffer
- **Responsibilities**:
  1. Manages shared client state across panels.
  2. Ingests high-frequency block evaluation events via WebSocket into a ring buffer:
     ```typescript
     // Web Worker / Ring Buffer Ingestion Pattern
     const eventBuffer: BlockEvaluationEvent[] = [];
     socket.onmessage = (event) => {
       eventBuffer.push(JSON.parse(event.data));
       // Flushed to Zustand at 60 fps via requestAnimationFrame
     };
     ```
  3. Validates incoming payload contracts with Zod before mutating state.

---

# 7. Three-Pane Workstation Layout Specification

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  MOCS-CERT OBSERVABILITY STUDIO v0.1.0        trajectories/prod_1us.xtc  [SHA: 4b2277...]   ● WS: 12ms   │
├───────────────────────┬─────────────────────────────────────────────────┬───────────────────────────────┤
│ EXPLORER & QUERY      │ 3D MOLECULAR & SPATIAL VIEWPORT                 │ INSPECTOR & PROOF TRACE       │
│                       │                                                 │                               │
│ [Exploration] [Proof] │ [Mol* Viewer] + [WebGL AABB Overlay]            │ Block #042                    │
│                       │ • Target Res 155: CA (Cyan AABB cage)           │ • Frames: [4200, 4300)        │
│ Contract / Query:     │ • Ligand O2 (Orange AABB cage)                  │ • Bounds: L=2.84 Å, U=3.65 Å  │
│ CONTACT(A:155:CA,     │ • Separation Vector: 3.12 Å [CERTIFIED TRUE]    │ • Predicate: < 4.0 Å          │
│         LIG:1:O2)     │                                                 │ • Status: CERTIFIED TRUE      │
│   < 4.0 A             │                                                 │                               │
│   FOR >= 100 ps       │                                                 │ Evidence Witnesses:           │
│                       │                                                 │ • 100/100 frames satisfied    │
│ Plan Selected:        │                                                 │                               │
│ • Plan-D (Refinement) │                                                 │ Proof Chain:                  │
│ • Est. Prune: 82.0%   │                                                 │ Claim ──► Evid ──► AABB ──► ✓ │
├───────────────────────┴─────────────────────────────────────────────────┴───────────────────────────────┤
│ TEMPORAL INTERVAL & BLOCK LATTICE TIMELINE (Canvas / D3.js)                                              │
│ 0 ns                               500 ns                             1000 ns                           │
│ [████████ TRUE ████████][░░░░ UNKNOWN ░░░░][▓▓▓▓ FALSE ▓▓▓▓][████████ TRUE ████████]                     │
│                ▲ Current Playhead: Frame 4250 (42.5 ns)                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⌘K Actions   |   Read: 18.4% OS Bytes   |   Pruned: 816/1000 Blocks   |   Memory: 184 MB   |   ✓ SOUND  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Using `react-resizable-panels`:
* **Panel A: Explorer & Query Studio (Left, 22–30% Width)**:
  * Workspace file selector with SHA-256 integrity badges.
  * Mode toggle: **Exploration Mode** vs **Proof Mode**.
  * Atom Selection Manager with live atom count pills.
  * Monaco Editor for MolQL DSL queries.
  * Planner Cost Card displaying candidate evaluations ($J(P)$) and expected I/O prune rates.
* **Panel B: Molecular Viewport & Temporal Timeline (Center, 45–55% Width)**:
  * 3D Canvas (Top 65%): Mol* cartoon structure + Three.js AABB cages and Euclidean caliper readouts.
  * Temporal Timeline (Bottom 35%): Canvas/D3 lattice with half-open intervals $[k_s, k_e)$ and synchronized scrubbing.
* **Panel C: Evidence Inspector & Certificate Auditor (Right, 22–30% Width)**:
  * Block & Evidence Inspector card with interval span, lower bound $L$, upper bound $U$.
  * TanStack Table + React Virtuoso for virtualized frame inspection.
  * Proof Trace DAG visualizing the deductive verification chain.
  * Machine Certificate JSON viewer with live schema validation and offline audit export.

---

# 8. Proof Mode: Interactive Deductive Verification

In **Proof Mode**, clicking any claim interactively traces the exact deductive chain:

```text
[User clicks Claim: "Hydrogen bond breaks BEFORE contact formed"]
                           │
                           ▼
              Interactive Proof Trace
                           │
 ┌─────────────────────────┴─────────────────────────┐
 │ 1. Claim: BEFORE(HBOND, CONTACT)                  │
 │    Status: CERTIFIED TRUE                         │
 ├───────────────────────────────────────────────────┤
 │ 2. Event A (HBOND): Interval [12000, 12451)       │
 │    • End Frame: 12451 (124.51 ns)                 │
 ├───────────────────────────────────────────────────┤
 │ 3. Event B (CONTACT): Interval [45120, 46000)     │
 │    • Start Frame: 45120 (451.20 ns)               │
 ├───────────────────────────────────────────────────┤
 │ 4. Deductive Condition: 12451 <= 45120            │
 │    • Soundness: Allen's Interval Precedence Holds │
 ├───────────────────────────────────────────────────┤
 │ 5. Witness Blocks:                                │
 │    • Block 124: [12400, 12500) -> Exact Refine    │
 │    • Block 451: [45100, 45200) -> U = 3.82 Å < 4Å │
 └───────────────────────────────────────────────────┘
```

Clicking any step in the trace automatically:
1. Re-centers the 3D Mol* camera on the relevant residues.
2. Draws the semi-transparent AABB bounding boxes around residue coordinates for that exact block.
3. Moves the timeline scrubber to that precise frame window.

---

# 9. Keyboard-First UX Protocol & Command Palette

### Keyboard Shortcuts
| Key Binding | Scope | Action |
|:---|:---|:---|
| `⌘ + K` or `Ctrl + K` | Global | Open **Global Command Palette** (`cmdk`) |
| `Space` | Timeline | Play / Pause trajectory timeline playback |
| `←` / `→` | Timeline | Step playhead backward / forward by 1 frame |
| `Shift + ←` / `→` | Timeline | Step backward / forward by 1 block ($b=100$) |
| `↑` / `↓` | Inspector | Select previous / next query or evidence witness |
| `P` | Global | Toggle **Proof Mode** / Exploration Mode |
| `B` | Viewport | Toggle **AABB Bounding Box** cages in 3D viewport |
| `R` | Viewport | Reset camera & center on active query atoms |
| `E` | Inspector | Open Evidence Table drawer |
| `Esc` | Modal/UI | Clear active selection / close modal |

### Global Command Palette (`cmdk`) Actions
* `Jump to Residue <id>` $	o$ Zooms camera to residue coordinates.
* `Run Query` $	o$ Submits active MolQL editor text to the compiler.
* `Filter Timeline: Pruned Only` $	o$ Isolates blocks skipped via AABB bounds.
* `Filter Timeline: Refined Only` $	o$ Isolates blocks requiring coordinate inspection.
* `Audit Certificate` $	o$ Verifies SHA-256 hashes and proof conditions offline.
* `Export Certificate (.json)` $	o$ Downloads cryptographically bound certificate.
* `Benchmark vs MDAnalysis` $	o$ Fires MOBench differential run on active query.

---

# 10. Curated Production `package.json`

```json
{
  "name": "mocs-studio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@tanstack/react-query": "^5.28.0",
    "@tanstack/react-table": "^8.15.0",
    "@use-gesture/react": "^10.3.1",
    "cmdk": "^1.0.0",
    "d3": "^7.9.0",
    "lucide-react": "^0.363.0",
    "molstar": "^4.0.0",
    "monaco-editor": "^0.47.0",
    "motion": "^11.0.24",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-resizable-panels": "^2.0.14",
    "react-virtuoso": "^4.7.5",
    "sonner": "^1.4.41",
    "three": "^0.162.0",
    "zod": "^3.22.4",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/node": "^20.11.30",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@types/three": "^0.162.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.6"
  }
}
```

---

# 11. Relationship to `RULE.md`

| Document | Primary Question | Scope | Governance |
|:---|:---:|:---|:---|
| [`RULE.md`](./RULE.md) | **WHY** | Design philosophy, hierarchy, semantic curves, surface levels, epistemic color canon, accessibility, visual forensics. | **Visual Constitution** |
| [`TECH_STACK.md`](./TECH_STACK.md) | **WHAT** | Specific libraries, rendering engines, Zustand store slices, 3D Mol* canvas, Three.js AABB cages, command palette, `package.json`. | **Implementation Architecture** |
