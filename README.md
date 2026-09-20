# MOCS-Cert: Molecular Dynamics Trajectory Query Engine with Certified Interval Pruning

<p align="center"><strong>Molecular Observability Compiler for Certified Query Execution</strong></p>

<p align="center">
  <img src="docs/images/MocsCert_Banner.png" alt="MOCS-Cert banner: molecular dynamics trajectory query engine with certified interval pruning and Mol* 3D visualization" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue" alt="Python 3.10 or newer">
  <img src="https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb" alt="Frontend: React 19 and TypeScript">
  <img src="https://img.shields.io/badge/API-FastAPI-009688" alt="API: FastAPI">
</p>

MOCS-Cert is a **molecular dynamics (MD) trajectory query engine** for declarative spatial queries over biomolecular trajectories (GROMACS XTC, PDB, GRO, and Binary CIF inputs). It compiles distance predicates into cost-based execution plans, uses conservative spatial and temporal bounds to prune intervals that cannot satisfy a query, refines uncertain intervals to exact frame-level evaluations, and produces hash-committed evidence that a separate verification stage can check.

It is designed for **computational biophysics, structural biology, molecular simulation, and scientific-software engineering** workflows where event detection needs to be both efficient and auditable.

> **Core idea:** replace indiscriminate frame-by-frame evaluation with **index-guided interval pruning + exact refinement + checkable evidence**.

**Author:** Moalim Javeed · **License:** [MIT](LICENSE)

## At a glance

| Area | Implementation |
|---|---|
| Core language | Python ≥ 3.10 |
| API service | FastAPI + Uvicorn + WebSockets |
| Workstation | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Molecular viewer | Mol* WebGL2 Canvas3D |
| Trajectory / structure inputs | PDB, Binary CIF, GRO, GROMACS XTC |
| Reference oracle | MDAnalysis ≥ 2.7 |
| Query semantics | Sampled-frame intervals + Kleene three-valued logic |
| Spatial acceleration | Molecular Coordinate Index (MCI), axis-aligned bounding boxes (AABB), 14-DOP (KDOP-14) |
| Evidence | IEEE 754 Float64 serialization + RFC 8785 JSON Canonicalization Scheme (JCS) + SHA-256 |

## Quick start

Run the backend and the frontend in two terminals from the repository root. See [Installation and running](#installation-and-running) for prerequisites and configuration.

```bash
# Terminal 1: backend (API on http://127.0.0.1:8000)
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -e ".[test]"
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: frontend (workstation on http://localhost:5173)
cd frontend
npm install
npm run dev
```

## Contents

- [Quick start](#quick-start)
- [Why MOCS-Cert](#why-mocs-cert)
- [Core capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Certified interval pruning](#certified-interval-pruning)
- [Query language](#query-language)
- [Execution planning](#execution-planning)
- [Spatial and temporal indexing](#spatial-and-temporal-indexing)
- [Evidence and execution certificates](#evidence-and-execution-certificates)
- [Verification model](#verification-model)
- [Molecular visualization](#molecular-visualization)
- [Datasets](#datasets)
- [Screenshots](#screenshots)
- [Repository structure](#repository-structure)
- [Technology stack](#technology-stack)
- [Installation and running](#installation-and-running)
- [Testing and verification](#testing-and-verification)
- [Benchmarks](#benchmarks)
- [Limitations](#limitations)
- [Scientific references](#scientific-references)
- [Citation and attribution](#citation-and-attribution)
- [License](#license)

---

## Why MOCS-Cert

Many trajectory-analysis workflows evaluate predicates by iterating through trajectory frames. For a sparse event, that can mean reading and decompressing a large fraction of a trajectory before the relevant frames are known.

MOCS-Cert changes the execution model by reasoning about **intervals before exact frame materialization**.

### Conventional frame-iterative workflow

```text
trajectory
  → read / decompress many frames
  → evaluate predicate per frame
  → return result
```

### MOCS-Cert execution model

```text
query
  → parse and compile (abstract syntax tree / intermediate representation)
  → bind molecular observables (atom resolution, periodic boundary conditions)
  → select an execution plan
  → use spatial and temporal indexes
  → conservatively prune impossible intervals
  → refine UNKNOWN intervals
  → materialize exact frames only for surviving candidates
  → emit canonical evidence
  → verify the result in a separate stage
  → project verified state into Mol* visualization
```

The output is therefore more than a set of intervals: it includes an **evidence trail for the pruning, refinement, and exact evaluations** that produced them.

## Core capabilities

### Declarative trajectory queries

Distance-contact predicates are expressed in a compact domain-specific language (DSL) and compiled into an Abstract Syntax Tree (AST) and Intermediate Representation (IR).

### Conservative spatial reasoning

The analysis engine computes lower and upper distance bounds over indexed trajectory intervals using supported periodic boundary condition (PBC) representations, including **axis-aligned bounding boxes (AABB)** and **14-DOP discrete oriented polytopes (KDOP-14, with 14 face normals)**.

### Cost-based execution planning

The planner can choose between:

- **Plan A:** index-first interval pruning
- **Plan B:** direct frame scanning
- **Plan C:** dyadic subdivision / refinement
- **Plan D:** full-scan fallback

<!-- TODO(maintainer): explain in one sentence how Plan B (direct frame scanning) differs from Plan D (full-scan fallback). -->

The selection is based on repository-defined cost inputs such as trajectory size, index availability, and predicate selectivity.

### Sampled-frame temporal semantics

Results are represented as half-open intervals:

```text
[k_s, k_e)
```

and evaluated using **Kleene three-valued logic**:

| Value | Meaning |
|---|---|
| `TRUE` | Certified for the whole interval |
| `FALSE` | Safely prunable for the whole interval |
| `UNKNOWN` | Requires refinement or exact evaluation |

### Evidence and verification

Scientific evidence is canonicalized and hashed so a separate verification stage can recompute digests and test invariants without trusting the producer's verdict.

### Deterministic molecular visualization

A `RenderScene` compiler projects canonical scientific state into Mol* Canvas3D, including molecular structures, witness frames, AABB cages, distance calipers, and selection reticles.

## Architecture

MOCS-Cert uses a unidirectional data flow. The 3D molecular viewer is a **downstream visual projection of canonical scientific state**; it does not define or modify scientific truth.

```text
Dataset (PDB / BCIF / GRO / XTC)
                │
                ▼
Query text (MOCS-Cert DSL)
                │
                ▼
          AST / IR
                │
                ▼
Observable binding (selectors + PBC)
                │
                ▼
Execution planner (Plan A / B / C / D)
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
 Analysis   Temporal   Spatial
  engine     lattice    indexes
(bounds +   (dyadic    (MCI +
distances)  blocks)    AABB / KDOP)
      └─────────┼─────────┘
                ▼
        Evidence record
                │
                ▼
      Execution certificate
                │
                ▼
      Verification engine
                │
                ▼
       RenderScene compiler
                │
                ▼
         Mol* Canvas3D
```

## Certified interval pruning

This is the central execution model.

### 1. Compilation and binding

A query string is parsed into an AST and lowered to IR. Selectors such as `name`, `resname`, `resid`, and `chain` are resolved through the structure hierarchy index to canonical atom indices. Periodic-boundary configuration is then established from the simulation cell.

### 2. Bounds over an interval

For a trajectory interval, the analysis engine computes an enclosure:

```text
[L, U]
```

for the relevant distance predicate using the indexed spatial bounds.

For an orthorhombic cell, the minimum-image displacement may be represented as:

$$
\mathbf{r}_{ij}^{\mathrm{PBC}} = \mathbf{r}_j - \mathbf{r}_i - \mathbf{h}\,\operatorname{round}\left(\mathbf{h}^{-1}(\mathbf{r}_j - \mathbf{r}_i)\right)
$$

where `h` is the cell matrix.

For skewed triclinic cells, independently rounding every fractional coordinate is not generally sufficient to guarantee the nearest periodic image. The implementation therefore treats triclinic support according to the actual image-selection logic and the cell conditions enforced by the repository; see [Limitations](#limitations).

### 3. Three-valued interval decision

For a distance threshold `τ` (the predicate holds when the distance is ≤ `τ`):

| Condition | Status | Action |
|---|---|---|
| `L > τ` | `FALSE` for the whole interval | Prune the interval; no exact frame evaluation is required for that interval |
| `U ≤ τ` | `TRUE` for the whole interval | Certify from the bound |
| Otherwise | `UNKNOWN` | Refine the interval |

The false-pruning condition is the key soundness property: **when `[L, U]` encloses the true distance, `L > τ` means no sampled frame in that interval can satisfy the predicate.**

### 4. Dyadic refinement

An `UNKNOWN` interval is recursively subdivided into smaller intervals. Verification checks the repository's monotonic non-expansion invariant:

$$
[L_{\mathrm{child}}, U_{\mathrm{child}}] \subseteq [L_{\mathrm{parent}}, U_{\mathrm{parent}}]
$$

### 5. Exact evaluation

Intervals that remain unresolved after refinement are evaluated at exact frame resolution, producing witness frames and exact distances.

### 6. Certification

The resulting evidence record is canonicalized with RFC 8785, hashed with SHA-256, and packaged as an execution certificate.

### 7. Separate verification

The verifier recomputes the relevant digests and checks invariants rather than accepting the producer's verdict as authoritative.

## Query language

The current query grammar is:

```text
FIND [ALL | FORALL] <selector_1> WITHIN <number>A OF <selector_2>
```

### Quantifiers

- The default existential form succeeds when at least one sampled frame satisfies the predicate.
- `ALL` / `FORALL` expresses the universal form over the sampled interval.

### Selectors

Examples include:

```text
(name CA)
(name C1')
(resname ALA)
(resid 87)
(chain A)
```

### Thresholds

Distances are positive values in ångström with a trailing `A`. `WITHIN τ` means distance ≤ `τ`:

```text
4.0A
2.800A
```

Negative thresholds raise `MOCSQuerySyntaxError`.

### Temporal semantics

Queries operate on discrete sampled-frame slots. Continuous-time requests are not represented by the current query semantics.

### Representative queries

Each query is a single line.

| Purpose | Query |
|---|---|
| Atom contact | `FIND (name CA) WITHIN 4.0A OF (name O2)` |
| Residue-level contact | `FIND (resname ALA) WITHIN 4.0A OF (resname LIG)` |
| Universal condition | `FIND ALL (name CA) WITHIN 10.0A OF (name O2)` |
| Exact threshold boundary | `FIND (name CA) WITHIN 2.800A OF (name O2)` |
| Coarse `UNKNOWN` condition requiring refinement | `FIND (name CA) WITHIN 3.9A OF (name O2)` |

## Execution planning

The planner organizes execution into nine logical stages:

1. Syntax parsing and AST generation.
2. Target-selection resolution to canonical trajectory indices.
3. PBC minimum-image setup.
4. Spatial index lookup in the Molecular Coordinate Index (MCI).
5. Coarse interval pruning against `[L_i, U_i]` and `τ`.
6. Dyadic refinement of uncertain blocks.
7. Exact witness-frame evaluation.
8. Certificate synthesis.
9. Deductive verification.

The plan variant is chosen from repository-defined cost inputs including trajectory size, index availability, and predicate selectivity. Implementation: [`mocs/planner/`](mocs/planner/).

## Spatial and temporal indexing

### Molecular Coordinate Index (MCI)

The MCI stores precomputed spatial bounds and frame-seek information in binary structures such as:

```text
blocks.bin
frame_offsets.bin
manifest.json
```

Implementation: [`mocs/mci/`](mocs/mci/).

### Memory mapping

Large index files are accessed through `mmap` so the index can be used for random-access lookups without loading the entire file into memory.

### Structure hierarchy index

Chains, residues, and atom names are resolved to contiguous zero-based indices for efficient selector binding.

### Temporal lattice

Trajectories are represented as sampled-slot intervals organized into dyadic blocks:

```text
[k_s, k_e)
```

Frames are zero-indexed inside the engine, while PDB `MODEL` records are conventionally one-indexed.

## Evidence and execution certificates

MOCS-Cert keeps scientific evidence separate from volatile application metadata.

### Coordinate digest

Materialized coordinates are serialized as IEEE 754 Float64 little-endian byte buffers and hashed with SHA-256 (`scientificDigest`).

### Canonical evidence

Evidence records are normalized using the [RFC 8785 JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785).

### Deterministic digest scope

Volatile values such as timestamps, session identifiers, and wall-clock latency are excluded from the scientific digest so the digest represents scientific content rather than execution-session metadata.

### Certificate representation

The current certificate representation consists of the canonical evidence record together with its SHA-256 digest.

Implementation: [`mocs/certificates/`](mocs/certificates/).

## Verification model

MOCS-Cert separates **scientific verification** from **renderer conformance**.

### Scientific verification

The verification stage:

- evaluates Kleene three-valued logic;
- checks certificate digests;
- checks interval contiguity;
- checks monotonic non-expansion of refined bounds;
- cross-checks pruning outcomes against the MDAnalysis reference oracle for tested inputs;
- fails closed when required verification conditions are violated.

### Renderer conformance

Renderer checks include finite geometry (`NaN` / `Inf` exclusion) and synchronization of Mol* representation state with the canonical scene revision.

### Scope of the guarantees

| Category | Statement |
|---|---|
| Implementation check | The verifier recomputes digests and tests repository-defined invariants; failed checks produce an invalid verification result. |
| Scientific condition | If a computed enclosure `[L, U]` contains the true sampled-frame distance, `L > τ` proves that no sampled frame in the interval satisfies the predicate. |
| Scope | The guarantee depends on supported cell geometry, correct minimum-image handling, correct bound computation, and the repository's sampled-frame semantics. |
| Reference testing | Agreement with the MDAnalysis oracle is evidence of consistency on tested inputs, not a proof for every possible input. |

The terms **certificate** and **deductive verification** here refer to MOCS-Cert's checked evidence records and invariant gate. They do not claim a proof mechanized by an external theorem prover or proof assistant.

## Molecular visualization

The workstation uses **Mol* Canvas3D** for interactive biomolecular visualization.

The renderer projects canonical scientific state into visualization state, including:

- molecular structures and witness frames;
- AABB wireframe overlays;
- distance calipers;
- selection reticles;
- diagnostics and provenance-oriented inspection surfaces.

### Interaction behavior

- Selecting an atom, residue, or chain creates a focused presentation.
- Closing the selection panel, clicking **Clear**, clicking the background, or pressing `Escape` restores the pre-selection camera and visual baseline without invoking a whole-scene `Fit`.
- **Clean View** removes overlays and diagnostics for unobstructed inspection.
- `DataLineageInspector` is available as an on-demand diagnostics surface.
- Dataset changes clear derived selections and evidence so state does not leak between datasets.
- `npm run verify:boundaries` enforces the viewer's import boundary and prevents Three.js from leaking into active viewer components.

## Datasets

Bundled structures live in [`frontend/public/structures/`](frontend/public/structures/).

Experimental structures are sourced from the [RCSB Protein Data Bank](https://www.rcsb.org/) / [wwPDB](https://www.wwpdb.org/), while predicted structures are sourced from the [AlphaFold Protein Structure Database](https://alphafold.ebi.ac.uk/).

AlphaFold DB models are distributed under CC BY 4.0 and require attribution; wwPDB archive data are released under CC0. See [Scientific references](#scientific-references).

<!-- TODO(maintainer): re-verify two rows against the bundled files. 1BNA: A:1:O5' to B:24:O3' is listed as 33.8 A, but C1 pairs with G24 (same end of the helix), so a shorter distance is expected. AF-P69905-F1: AlphaFold models use UniProt numbering (Met1, Val2, ..., Arg142), so A:1:VAL / A:141:ARG looks like mature-chain numbering. -->

| ID | Type | Description | Method / resolution | Canonical demonstration |
|---|---|---|---|---|
| `4HHB` | Experimental | Human deoxyhemoglobin tetramer | X-ray, 1.74 Å | Heme contact `A:87:NE2` ↔ `HEM:142:FE`, 2.14 Å |
| `1BNA` | Experimental | B-DNA dodecamer `CGCGAATTCGCG` | X-ray, 1.90 Å | Nucleic-acid distance `A:1:O5'` ↔ `B:24:O3'`, 33.8 Å |
| `1TUP` | Experimental | p53 core domain bound to DNA | X-ray, 2.20 Å | Protein–DNA contact `A:248:ARG` ↔ `E:11:DT`, 3.2 Å |
| `1STP` | Experimental | Streptavidin–biotin complex | X-ray, 2.60 Å | Binding-pocket contact `A:49:ASN` ↔ `BTN:300:O2`, 2.78 Å |
| `1CRN` | Experimental | Crambin, plant seed protein | X-ray, 1.50 Å | Terminus distance `A:1:THR` ↔ `A:46:ASN`, 24.6 Å |
| `6VXX` | Experimental | SARS-CoV-2 spike glycoprotein, closed state | Cryo-EM, 2.80 Å | Inter-protomer distance `A:500:CA` ↔ `B:500:CA`, 45.2 Å |
| `AF-P69905-F1` | Predicted | Human hemoglobin subunit alpha | AlphaFold DB | Terminus distance `A:1:VAL` ↔ `A:141:ARG`, 39.2 Å |
| `AF-P04637-F1` | Predicted | Human cellular tumor antigen p53 | AlphaFold DB | Core-domain span `A:100:GLN` ↔ `A:290:ARG`, 28.5 Å |
| `synth_500f` | Trajectory | Synthetic MD benchmark, 500 frames, 10 ps/step | Deterministic step trajectory | Block 41 witness `A:155:CA` ↔ `LIG:1:O2`, 3.72 Å |

The experimental entries exercise static structure loading, ligand contacts, protein–DNA analysis, and selector handling. The AlphaFold entries exercise predicted-model loading. `synth_500f` is the bundled multi-frame trajectory used for temporal-lattice, pruning, and refinement demonstrations.

## Screenshots

### Query editor

Validated molecular-distance query, observable contract, and compile-and-execute workflow.

<p align="center">
  <img src="docs/images/demo3.png" alt="MOCS-Cert workstation showing the query editor with a molecular-distance query and its observable contract" width="100%">
</p>

### Workstation and execution plan

The 4HHB workstation view combines the molecular viewport with the staged execution plan and inspection controls.

<p align="center">
  <img src="docs/images/demo7.png" alt="MOCS-Cert workstation with the 4HHB structure beside the staged execution plan" width="100%">
</p>

### Molecular views

Mol* representation controls, evidence overlays, and conformance status for 6VXX and 1TUP.

<p align="center">
  <img src="docs/images/demo4.png" alt="Molecular view of the 6VXX SARS-CoV-2 spike glycoprotein structure with representation controls and conformance status" width="100%">
</p>

<p align="center">
  <img src="docs/images/demo6.png" alt="Molecular view of the 1TUP p53-DNA complex with evidence overlays" width="100%">
</p>

### Structure catalog

Experimental, predicted, and computed structures available for loading.

<p align="center">
  <img src="docs/images/demo5.png" alt="MOCS-Cert structure catalog listing experimental and predicted molecular structures" width="100%">
</p>

### Index catalog

MCI readiness, dataset invariants, seek-table metadata, and spatial commitments.

<p align="center">
  <img src="docs/images/demo2.png" alt="MOCS-Cert index catalog showing MCI readiness, dataset invariants, and seek-table metadata" width="100%">
</p>

### Formal audit

Certificate status, invariant checks, and reference-agreement targets.

<p align="center">
  <img src="docs/images/demo1.png" alt="MOCS-Cert formal audit view showing certificate status and invariant checks" width="100%">
</p>

## Repository structure

Maintained public application structure for the FastAPI/Python core and React/Vite workstation:

```text
mocs-cert/
├── backend/                    # FastAPI ASGI service
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/      # REST routes
│   │   │   └── websockets/     # WebSocket query streaming
│   │   ├── core/               # Compiler, trajectory, certificate services
│   │   ├── schemas/            # Pydantic models
│   │   └── main.py             # ASGI entrypoint
│   └── tests/                  # Backend tests
├── frontend/                   # React 19 + Vite workstation
│   ├── public/structures/      # Bundled structures and trajectories
│   └── src/
│       ├── api/                # Typed client and execution orchestration
│       ├── components/         # Editor, evidence, plan, proof, timeline, viewer, etc.
│       ├── molecular/          # Registry, resolvers, calculations
│       ├── renderer/           # RenderScene compiler and Mol* adapter
│       ├── store/              # Zustand slices
│       └── tests/              # Frontend integration/adversarial suites
├── mocs/                       # Core Python package
│   ├── arrays/                 # NumPy / SciPy dispatch
│   ├── bounds/                 # Periodic AABB and KDOP-14 bounds
│   ├── certificates/           # RFC 8785 certificate generation
│   ├── ecosystem/              # External-library interoperability
│   ├── ir/                     # Query AST / IR
│   ├── mci/                    # Molecular Coordinate Index
│   ├── planner/                # Cost-based plan selection
│   ├── reference/              # Reference truth oracles
│   └── semantics/              # Kleene three-valued logic and interval semantics
├── tests/                      # Python tests and golden fixtures
├── docs/images/                # README banner and screenshots
├── test_modular_mocs.py        # Modular invariant checks
├── GATES.md                    # Release-gate status
├── LICENSE                     # MIT license
└── pyproject.toml              # Package configuration
```

## Technology stack

Exact dependency versions are defined by the repository manifests.

### Frontend

| Layer | Technologies |
|---|---|
| UI | React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI, Lucide, GSAP |
| 3D molecular | Mol* WebGL2 Canvas3D via `@mocs/renderer-molstar` |
| Time | D3.js + HTML5 Canvas dyadic block lattice |
| Evidence | TanStack Table, Monaco Editor, KaTeX |
| State | Zustand with decoupled stores, atomic selectors, revision fencing, and WebSocket ingestion |

### Backend and scientific core

- **`mocs/`** — Kleene logic, periodic minimum-image computations, KDOP-14, refinement, seek tables, certificates, and semantic execution logic.
- **`backend/`** — FastAPI, Uvicorn, WebSockets, and Pydantic v2.
- **Numerics** — NumPy and SciPy.
- **Reference verification** — MDAnalysis.

## Installation and running

Start the backend first, then the frontend; the workstation runs queries through the backend API.

### Prerequisites

- Python 3.10+
- Node.js 20.19+ or 22.12+ (required by the project's Vite toolchain)
- A WebGL2-capable browser for the molecular viewer
- Hardware acceleration recommended for interactive 3D visualization

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The workstation is served at:

```text
http://localhost:5173
```

### Python package and backend

From the repository root:

```bash
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -e ".[test]"
```

Run the backend with:

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

### Frontend configuration

Create `frontend/.env` when using the Mol*-native viewer configuration:

```dotenv
VITE_USE_VIEWER_V2=true
```

### Backend configuration

Configuration is defined in `backend/app/config.py` and can be overridden with environment variables.

| Variable | Default | Purpose |
|---|---|---|
| `MOCS_PROJECT_NAME` | `MOCS-Cert` | Service display name |
| `MOCS_API_V1_STR` | `/api/v1` | API routing prefix |
| `MOCS_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed CORS origins |
| `MOCS_DEFAULT_HOST` | `127.0.0.1` | ASGI bind address |
| `MOCS_DEFAULT_PORT` | `8000` | ASGI port |
| `MOCS_ARRAY_BACKEND` | `auto` | Array dispatcher (`auto`, `numpy`, `scipy`) |

## Testing and verification

Run these commands to verify a checkout.

| Layer | Command | Purpose |
|---|---|---|
| Frontend tests | `cd frontend && npm test -- --run` | Unit, integration, and adversarial frontend coverage |
| Import boundaries | `cd frontend && npm run verify:boundaries` | Ensures Three.js does not leak into active viewer components |
| Production build | `cd frontend && npm run build` | TypeScript build and Vite production bundle |
| Modular invariants | `python test_modular_mocs.py` | Logic, PBC bounds, KDOP-14, refinement, interval semantics, certificates, planner, and I/O invariants |
| Golden query corpus | `pytest tests/test_golden_query_corpus.py -q` | Differential execution of canonical query fixtures through the API |
| Release gates | `node .agents/skills/unlazy/scripts/gate-check.mjs --status GATES.md` | Maintainer release-gate verification |

## Benchmarks

The current benchmark figures come from `frontend/src/tests/renderer/benchmarks/benchmark.test.ts` and should be interpreted as **local micro-benchmarks**, not end-to-end trajectory-query performance.

| Measurement | Reported value | Interpretation |
|---|---:|---|
| Trajectory frame update | 0.0295 ms mean CPU time/update | Scene-state update cost; reciprocal is a theoretical dispatch rate, not rendered FPS |
| AABB mesh construction | 1 box: 1.27 ms; 10: 0.81 ms; 50: 0.94 ms; 100: 1.47 ms | Geometry construction micro-benchmark; timings are not a scaling curve |
| RFC 8785 canonical hashing | 0.284 ms mean / 1,000-atom evidence record | Canonicalization + hashing cost |
| WebSocket frame latency | < 1.2 ms round trip | Local development loopback |

No end-to-end benchmark in this README establishes a speedup over MDAnalysis, MDTraj, or another trajectory-analysis implementation. Actual pruning benefit depends on the trajectory, query, threshold, index quality, and workload.

## Limitations

### Cell geometry

Orthorhombic cells and supported non-degenerate triclinic cells are handled subject to the implementation's minimum-image logic and validation constraints. Zero-volume, collinear, or heavily degenerate cells raise `MOCSUnsupportedGeometryError`.

Strongly skewed triclinic cells require particular care because the nearest periodic image is not generally obtained by independently rounding every fractional coordinate.

### Discrete time

MOCS-Cert evaluates **sampled frames**. Events occurring between sampled frames are not directly observed, so guarantees are stated over the repository's discrete temporal semantics.

### Floating-point bounds

Bounds are computed in floating point. The exact rounding treatment and cell-validity assumptions are defined by the implementation under [`mocs/bounds/`](mocs/bounds/).

### Reference oracle

MDAnalysis agreement provides differential consistency for tested inputs; it is not an independent proof of universal correctness. Shared errors between the implementation and the oracle would not be detected by differential comparison alone.

### Benchmark scope

Published benchmark figures cover renderer, evidence-hashing, and local WebSocket components rather than full trajectory-query throughput.

### Remote structures

Structures not bundled in `frontend/public/structures/` require network access to their upstream data services.

### WebGL2

The molecular viewer requires a WebGL2-capable browser. Headless CI environments require appropriate canvas mocking or equivalent test support.

## Scientific references

### Trajectory analysis and reference tooling

- Michaud-Agrawal, N., Denning, E. J., Woolf, T. B., Beckstein, O. “MDAnalysis: A toolkit for the analysis of molecular dynamics simulations.” *Journal of Computational Chemistry* 32, 2319–2327 (2011). [doi:10.1002/jcc.21787](https://doi.org/10.1002/jcc.21787)
- Gowers, R. J. et al. “MDAnalysis: A Python package for the rapid analysis of molecular dynamics simulations.” *Proceedings of the 15th Python in Science Conference* (2016). [doi:10.25080/Majora-629e541a-00e](https://doi.org/10.25080/Majora-629e541a-00e); project site: [mdanalysis.org](https://www.mdanalysis.org/)

### Molecular visualization

- Sehnal, D. et al. “Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures.” *Nucleic Acids Research* 49, W431–W437 (2021). [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314)

### Geometry, periodic boundaries, and logic

- Klosowski, J. T., Held, M., Mitchell, J. S. B., Sowizral, H., Zikan, K. “Efficient collision detection using bounding volume hierarchies of k-DOPs.” *IEEE Transactions on Visualization and Computer Graphics* 4(1), 21–36 (1998). [doi:10.1109/2945.675649](https://doi.org/10.1109/2945.675649)
- Allen, M. P., Tildesley, D. J. *Computer Simulation of Liquids*, 2nd ed. Oxford University Press (2017).
- Kleene, S. C. *Introduction to Metamathematics*. North-Holland (1952).

### Standards

- Rundgren, A., Jordan, B., Erdtman, S. [RFC 8785: JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785) (2020).
- NIST, [FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) (2015).
- IEEE, *IEEE Standard for Floating-Point Arithmetic*, IEEE Std 754-2019.

### Structural data

- [RCSB Protein Data Bank](https://www.rcsb.org/) and [wwPDB](https://www.wwpdb.org/).
- Varadi, M. et al. “AlphaFold Protein Structure Database: massively expanding the structural coverage of protein-sequence space with high-accuracy models.” *Nucleic Acids Research* 50, D439–D444 (2022). [doi:10.1093/nar/gkab1061](https://doi.org/10.1093/nar/gkab1061); database: [alphafold.ebi.ac.uk](https://alphafold.ebi.ac.uk/)
- Jumper, J. et al. “Highly accurate protein structure prediction with AlphaFold.” *Nature* 596, 583–589 (2021). [doi:10.1038/s41586-021-03819-2](https://doi.org/10.1038/s41586-021-03819-2)

## Citation and attribution

If you use MOCS-Cert in academic work, please cite it as:

> Javeed, M. (2026). *MOCS-Cert: Molecular Observability Compiler for Certified Query Execution* [Computer software].

<!-- TODO(maintainer): add the repository URL and a release version or DOI to the citation, and consider adding a CITATION.cff. -->

MOCS-Cert builds on and/or interoperates with Mol*, MDAnalysis, RFC 8785, SHA-256, and structural data distributed through the wwPDB and AlphaFold Protein Structure Database.

## License

MOCS-Cert is released under the [MIT License](LICENSE).
