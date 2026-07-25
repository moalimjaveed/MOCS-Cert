# MOCS-Cert — Trajectory Pipeline & Frame Scrubbing Specification
**Subsystem:** Molecular Dynamics Trajectory Streaming & Frame-Accurate Scrubbing  
**Document Index:** 40  
**Epistemic Baseline:** Sampled-Slot Temporal Invariants $[k_s, k_e)$  

---

## 1. Overview & Temporal Grounding

In standard molecular dynamics analysis, researchers must trace conformational transitions across thousands of discrete time steps.

MOCS-Cert interfaces directly with MD trajectory streams (GROMACS `.gro` and `.xtc` formats) and temporal certificates. Every trajectory satisfies the sampled-slot temporal semantics defined in `TEMPORAL_SEMANTICS.md`:
- Each frame $k \in [0, K-1]$ represents a snapshot at discrete simulation time $t_k = t_0 + k \cdot \Delta t$.
- Witness blocks partition the trajectory into discrete intervals $[k_s, k_e)$.
- Trajectory envelopes maintain conservative spatial bounds across the entire interval:
  $$\text{AABB}_{[k_s, k_e)} = \bigcup_{k=k_s}^{k_e - 1} \text{AABB}(k)$$

---

## 2. Zero-Jump Frame Scrubbing Pipeline

A classic defect in web-based molecular viewers is **camera reset on frame scrubbing**: when the user scrubs the timeline slider, the viewer reloads the file, causing the camera to snap back to default distance and orientation.

MOCS-Cert enforces a **zero-jump frame scrubbing pipeline**:

```
[User scrubs timeline slider to frame k]
                   │
                   ▼
       [setWitnessFrame(k)]
                   │
                   ▼
[MolstarViewer: witnessFrame Effect fires]
                   │
  Is current structure a trajectory?
       │
       ├── YES:
       │    1. Retrieve Model Cell Ref from Mol* state tree
       │    2. Execute in-place model update:
       │       plugin.state.data.build()
       │         .to(modelCellRef)
       │         .update({ modelIndex: k })
       │         .commit()
       │    3. Re-extract active frame coordinates:
       │       extractCoordinatesFromMolstarModel(model)
       │    4. Update Three.js overlay Box3 and caliper endpoints
       │    5. DO NOT touch plugin.canvas3d.camera!
       │
       └── NO:
            No-op. Static crystal structures remain locked.
```

### Camera Invariance Invariant
$$\mathbf{C}_{\text{pos}}(k + 1) = \mathbf{C}_{\text{pos}}(k), \quad \mathbf{C}_{\text{rot}}(k + 1) = \mathbf{C}_{\text{rot}}(k), \quad \mathbf{C}_{\text{zoom}}(k + 1) = \mathbf{C}_{\text{zoom}}(k)$$
The camera state is invariant under frame index transitions.

---

## 3. Coordinate Extraction & Dynamic Overlays

When a frame transition commits:
1. `extractCoordinatesFromMolstarModel` reads the active frame's Cartesian atomic positions directly from the Mol* `Structure` coordinates arrays (`x`, `y`, `z`).
2. Tightly fitted `Box3` bounds are derived for each semantic component (`protein`, `nucleic`, `ligand`).
3. If the active AABB mode is `selection`, the Three.js bounding cage updates immediately to enclose the frame's atoms.
4. If the active AABB mode is `block`, the bounding cage expands to the conservative union envelope defined by Block 41 proof metadata, ensuring mathematical soundness.

---

## 4. Periodic Boundary Conditions (PBC) & Minimum-Image Handling

MD simulations are conducted in periodic boxes (orthorhombic, triclinic, or dodecahedral).
- Biopolymers crossing box boundaries may suffer from artificial "splintering" if rendered raw without unwrapping.
- MOCS-Cert ensures Mol* applies structural un-periodicity algorithms (`auto-wrap` / `whole-molecules`) prior to representation generation.
- Distance calculations strictly obey the minimum-image convention:
  $$\Delta x_{\text{MIC}} = \Delta x - L_x \cdot \operatorname{round}\left(\frac{\Delta x}{L_x}\right)$$
  ensuring no spurious distance spikes occur across periodic faces.
