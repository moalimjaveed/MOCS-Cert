# MOCS-Cert — Evidence Visualization & Spatial AABB Calculus
**Subsystem:** Spatial Evidence Inspection, Caliper Measurement & Proof Envelope Calculus  
**Document Index:** 41  
**Epistemic Baseline:** Rigorous Geometric Bounds & Cryptographic Verification  

---

## 1. Overview & Epistemic Role of Spatial Evidence

In MOCS-Cert, spatial visualizations are not mere aesthetic illustrations; they serve as interactive **geometric witnesses** in machine proof certificates.

When an analyst queries a molecular trajectory (e.g. *Find all time intervals where Hemoglobin alpha-beta distance $\le 4.5 \text{ \AA}$*), the compiler generates a cryptographic certificate containing:
1. Candidate interval bounds $[k_s, k_e)$.
2. Spatial bounding cages (AABB envelopes) proving non-intersection or potential proximity.
3. Multi-tier I/O accounting demonstrating the computational efficiency of index filtering.

---

## 2. Cartesian AABB Calculus

For any set of atoms $S \subset \{1, \dots, N\}$ with Cartesian positions $\{r_i = (x_i, y_i, z_i)\}_{i \in S}$:

### 2.1 Extrema Vectors
$$\mathbf{r}_{\min} = \left(\min_{i \in S} x_i, \; \min_{i \in S} y_i, \; \min_{i \in S} z_i\right)$$
$$\mathbf{r}_{\max} = \left(\max_{i \in S} x_i, \; \max_{i \in S} y_i, \; \max_{i \in S} z_i\right)$$

### 2.2 Dimensions and Volume
$$\Delta X = x_{\max} - x_{\min}, \quad \Delta Y = y_{\max} - y_{\min}, \quad \Delta Z = z_{\max} - z_{\min}$$
$$\text{Volume} = \Delta X \cdot \Delta Y \cdot \Delta Z \quad [\text{\AA}^3]$$

### 2.3 Bounding Modes: Selection AABB vs Block Proof Envelope
MOCS-Cert provides two explicit bounding modes in the CommandBar:
1. **Selection AABB:** Tightly fits the selected polymer or ligand component in the active snapshot frame. Minimizes volume $\text{Vol}(k)$.
2. **Block Proof Envelope:** Computes the outer conservative bounding box covering all frames in the witness block $[k_s, k_e)$:
   $$\text{AABB}_{\text{block}} = \left[\min_{k \in [k_s, k_e)} \mathbf{r}_{\min}(k), \; \max_{k \in [k_s, k_e)} \mathbf{r}_{\max}(k)\right]$$
   Guarantees that no atomic trajectory trajectory escapes the envelope during the verified time interval.

---

## 3. Interactive Cartesian 3D Calipers

MOCS-Cert includes a native 3D measurement caliper engine:

- **State Machine:**
  $$\text{idle} \xrightarrow{\text{Measure clicked}} \text{selecting-first-atom} \xrightarrow{\text{Atom A clicked}} \text{selecting-second-atom} \xrightarrow{\text{Atom B clicked}} \text{measured}$$
- **Cartesian Distance Calculation:**
  Given Atom A at $\mathbf{r}_A = (x_A, y_A, z_A)$ and Atom B at $\mathbf{r}_B = (x_B, y_B, z_B)$:
  $$d(A, B) = \|\mathbf{r}_A - \mathbf{r}_B\| = \sqrt{(x_A - x_B)^2 + (y_A - y_B)^2 + (z_A - z_B)^2}$$
- **Rendering:**
  Renders a dashed precision line connecting $\mathbf{r}_A$ and $\mathbf{r}_B$, with spherical tick endpoints and an anchored floating badge displaying the numerical distance in Ångströms with 2 decimal places.
- **Threshold Comparison:**
  If $d(A, B) \le d_{\text{threshold}}$, the indicator illuminates in Emerald Green (`#059669`), proving satisfaction of the proximity observable. If $d(A, B) > d_{\text{threshold}}$, it displays in Slate Grey (`#64748B`).

---

## 4. Multi-Tier I/O Accounting

The Evidence Inspection Drawer displays precise multi-tier I/O accounting metrics:
- **OS Bytes Read:** Raw bytes transferred from disk storage or network buffer during trajectory decompression.
- **Index Bytes Evaluated:** B-tree / BRIN index seek bytes queried to isolate the candidate block.
- **Refinement Ratio:** Ratio of index seek volume to raw disk volume, proving acceleration up to $34.5\times$ over linear table scans.
- **SHA-256 Checksum:** Immutable digest anchoring the certificate to the original structural coordinate file.
