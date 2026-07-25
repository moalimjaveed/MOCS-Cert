# MOCS-Cert — Molecular Architecture Specification
**Subsystem:** 3D Molecular Rendering & Biophysical Visualization  
**Engine:** Mol* (`molstar`) + Three.js Overlay Pipeline  
**Document Index:** 37  
**Epistemic Baseline:** Strictly Defensible Scientific Visualization  

---

## 1. Executive Summary & Purpose

The MOCS-Cert Molecular Viewport is engineered to provide an authoritative, biophysically accurate structural workstation for analyzing molecular dynamics (MD) trajectories, static experimental crystallographic assemblies, nucleic acids, and computational protein designs.

Unlike decorative 3D web viewers or naive three-dimensional dashboards, MOCS-Cert observes a strict separation of concerns:
1. **Primary Biophysical Renderer:** Mol* (`molstar`) is the authoritative rendering engine for all biopolymers (proteins, nucleic acids, ligands, waters, and ions). No hand-crafted, custom geometry approximations (such as fabricated ribbons or mock spheres) are ever substituted for Mol*'s validated secondary structure splines and surface algorithms.
2. **Spatial Proof Overlay:** Three.js coordinates an invisible, synchronized WebGL canvas layered directly over the Mol* canvas to render conservative Axis-Aligned Bounding Boxes (AABB), minimum-image convention bounding cages, and non-drifting Cartesian distance calipers.
3. **Decoupled Epistemic Authority:** Molecular coordinates and structural topologies originate solely from authentic PDB, mmCIF, or GRO/XTC trajectory files or from verified MOCS certificate seek tables.

---

## 2. Decoupled 5-Engine Architecture

In compliance with `TECH_STACK.md` and `RULE.md`, the client architecture adheres to five decoupled engines:

```
+-----------------------------------------------------------------------------+
|                                1. UI ENGINE                                 |
|          Fluent Light Mode CommandBar, Dropdowns, Metric Tiles              |
|        (shadcn/ui primitives, Radix UI, Tailwind CSS, Lucide icons)         |
+--------------------------------------+--------------------------------------+
                                       |
        +------------------------------+------------------------------+
        |                                                             |
+-------v-------------------------+         +-------------------------v-------+
|          2. 3D ENGINE           |         |         3. TIME ENGINE          |
|  - Mol* Biopolymer Engine       |         |  - D3.js Interval Lattice       |
|    (Cartoon, Sticks, Spheres)   |         |  - Microsecond Timeline Scrubber|
|  - Three.js Overlay Canvas      |         |  - Web Worker Frame Decoders    |
|    (AABB Cages, Calipers, Ray)  |         +---------------------------------+
+---------------------------------+                                   |
        |                                                             |
+-------v-------------------------+         +-------------------------v-------+
|       4. EVIDENCE ENGINE        |         |         5. STATE ENGINE         |
|  - TanStack Table / Virtuoso    |         |  - Zustand Atomic Slices        |
|  - Monaco MolQL-Cert DSL Studio |         |  - TanStack Query Cache         |
|  - Proof DAG Witness Inspector  |         |  - WebSocket Frame Ring Buffer  |
+---------------------------------+         +---------------------------------+
```

### Engine Responsibilities

- **UI Engine (`MolecularViewport.tsx`):** Maintains the Fluent Light Mode (#FFFFFF) chrome, viewport headers, representation selectors (`cartoon`, `sticks`, `spheres`, `surface`, `backbone`), layer visibility toggles, and measurement banners. It never manipulates raw WebGL state directly.
- **3D Engine (`MolstarViewer.tsx`):** Houses the headless or embedded Mol* `PluginContext`. Manages biopolymer parsing, representation hierarchy nodes (`StructureRepresentationComponent`), spatial transformations, and camera synchronization.
- **Three.js Overlay:** Renders lightweight line meshes (`LineSegments`, `Box3Helper`, `Sprite` annotations) in screen-projected Cartesian coordinates, strictly linked to the Mol* world transform matrix.

---

## 3. Representations & Representation Selection Hierarchy

Biopolymers are parsed through Mol*'s `Structure` hierarchy and classified into distinct semantic groups:

1. **Polypeptides (Proteins):**
   - Standard: Secondary structure cartoon spline representation (`polymer` representation type).
   - Low-atom count fallback (< 20 atoms, e.g. synthetic single-residue test peptides): Automatically represented as `ball-and-stick` or `spheres` to guarantee visibility when no peptide backbone splines can be interpolated.
2. **Nucleic Acids (DNA / RNA):**
   - Standard: Cartoon ladder spline depicting ribose-phosphate backbones and nucleobase rungs.
   - Dual-stand integrity: Hydrogen bonding networks and base stacking are preserved natively via Mol* topology resolvers without geometry disconnects.
3. **Ligands & Cofactors:**
   - Default: Ball-and-stick / sticks representation with elemental CPK coloring (Carbon: Grey/Green, Oxygen: Red, Nitrogen: Blue, Sulfur: Yellow, Iron: Orange/Rust).
4. **Solvent (Water & Ions):**
   - Default: Hidden by default for performance; toggleable via the *Layers* dropdown. Rendered as non-bonded spheres or small cross stars.

---

## 4. Camera Synchronization & Measurement Stability

A key defect identified in naive Three.js/Mol* hybrid viewers is **camera drift**, where overlays (such as calipers or bounding boxes) lag or drift during user orbit/pan/zoom actions.

MOCS-Cert resolves this via synchronous event loop subscription:
1. The Mol* camera state (`plugin.canvas3d.camera.stateChanged`) fires synchronous update events during every camera animation and user interaction tick.
2. The Three.js overlay camera is directly bound to Mol*'s camera projection matrix ($P$) and view matrix ($V$):
   $$M_{\text{overlay}} = P_{\text{Mol*}} \times V_{\text{Mol*}}$$
3. Caliper endpoints and AABB cage vertices are transformed identically in homogeneous coordinates, completely eliminating spatial drift.
4. Frame scrubbing (`witnessFrame`) updates only the trajectory `modelIndex` in the existing Mol* data cell; the camera position and zoom factor are strictly preserved (`camera.reset()` is never invoked during frame scrubbing).

---

## 5. Memory Management & WebGL Context Lifecycle

To prevent GPU resource leaks when rapidly toggling between structures or scrubbing long trajectories:
- All Mol* instances unmount cleanly via `plugin.dispose()`, releasing all vertex buffer objects (VBOs) and texture memory.
- Three.js overlay scenes explicitly traverse and dispose all geometries (`geometry.dispose()`) and materials (`material.dispose()`).
- Event listeners for resize, wheel, and pointer interactions are removed deterministically upon unmount.
