# Method Specification: PBC Minimum-Image Convention
## Method ID: METH-001

### 1. Mathematical Formulation
In a periodic simulation cell defined by box dimensions $\mathbf{L} = (L_x, L_y, L_z)$, the displacement vector between two atoms at coordinates $\mathbf{r}_A$ and $\mathbf{r}_B$ under the minimum-image convention is given by:

$$\Delta \mathbf{r} = \mathbf{r}_B - \mathbf{r}_A$$
$$\Delta \mathbf{r}_{	ext{MIC}} = \Delta \mathbf{r} - \mathbf{L} \odot \left\lfloor rac{\Delta \mathbf{r}}{\mathbf{L}} + rac{1}{2} ightfloor$$
$$d_{	ext{MIC}} = \|\Delta \mathbf{r}_{	ext{MIC}}\|_2$$

### 2. Implementation Invariant
MOCS-Cert guarantees that $d_{	ext{MIC}}$ is identical within numerical floating-point epsilon to MDAnalysis reference distance calculations.
