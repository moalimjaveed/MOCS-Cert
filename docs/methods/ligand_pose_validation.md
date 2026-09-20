# Method Specification: Ligand Pose Validation (PoseBusters)
## Method ID: METH-007

### 1. Scientific Overview
Applies 18 physical-chemical checks to eliminate generative hallucinations:
- Bond length deviation $\le 0.25	ext{ \AA}$
- No steric overlap $\le 1.8	ext{ \AA}$ with receptor atoms
- Planarity of aromatic systems
