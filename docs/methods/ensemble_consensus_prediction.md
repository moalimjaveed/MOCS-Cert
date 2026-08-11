# Method Specification: Ensemble Consensus Prediction
## Method ID: METH-008

### 1. Scientific Overview
Rigid-body C-alpha Kabsch alignment across diverse predictive models (Boltz-1, Chai-1, Protenix, OpenFold).

### 2. Critical Invariant
**NEVER AVERAGE COORDINATES.**
Maps consensus residue spans ($d < 1.5	ext{ \AA}$) and disagreement loops ($d \ge 1.5	ext{ \AA}$).
