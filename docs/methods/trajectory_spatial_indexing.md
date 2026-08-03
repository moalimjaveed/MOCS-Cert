# Method Specification: Trajectory Spatial Indexing
## Method ID: METH-003

### 1. Mathematical Formulation
For any coordinate trajectory chunk covering frames $[k_s, k_e)$, the bounding envelope is defined by the tightest enclosure:

$$\mathbf{b}_{\min} = \min_{k \in [k_s, k_e)} \mathbf{r}(k), \quad \mathbf{b}_{\max} = \max_{k \in [k_s, k_e)} \mathbf{r}(k)$$

Conservative minimum distance lower bound between two selection envelopes $A$ and $B$:
$$d_{\min}(A, B) = \sqrt{\sum_{i \in \{x,y,z\}} \max(0, \max(b_{A,\min,i} - b_{B,\max,i}, b_{B,\min,i} - b_{A,\max,i}))^2}$$
