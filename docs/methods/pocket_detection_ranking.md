# Method Specification: Pocket Detection & Ranking
## Method ID: METH-004

### 1. Scientific Overview
Combines machine learning Connolly surface point evaluation (P2Rank) with Voronoi alpha-sphere geometry (fpocket).

### 2. Score Semantics Invariant
Outputs must strictly preserve upstream machine learning probability and raw ranking score. They must never be represented as thermodynamic $\Delta G$ or binding constants $K_d$.
