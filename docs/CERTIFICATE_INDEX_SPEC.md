# CERTIFICATE_INDEX_SPEC.md — Molecular Certificate Index (MCI) Technical Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Research Baseline  
**Cross-References:** [`MATHEMATICAL_MODEL.md`](MATHEMATICAL_MODEL.md), [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md), [`CERTIFICATE_SPEC.md`](CERTIFICATE_SPEC.md), [`PBC_SEMANTICS.md`](PBC_SEMANTICS.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md).

---

## 1. Executive Summary and Architecture

The **Molecular Certificate Index (MCI)** is the load-bearing data structure that enables MOCS-Cert to prune coordinate inspection without compromising deductive soundness. 

### 1.1 Fundamental Design Correction
MCI does **NOT** build an indiscriminate full-trajectory spatial index for every atom in the system prior to knowing workload demand. Pre-indexing all coordinates would create multi-gigabyte sidecars and negate the economic benefits of compilation.

Instead, MCI utilizes a **lazy, selection-driven, two-level architecture**:
* **Level 0 (Global Trajectory Manifest & Source Map):** Constructed once per trajectory during `mocs.open()` via eager Level-0 validation. Contains trajectory-wide metadata, block partition boundaries, simulation box parameters, cryptographic source hashes, and a byte-offset seek table.
* **Level 1 (Lazy Selection-Specific Motion Summaries):** Materialized lazily on-demand only when a query references specific atom selections. Summaries are cached and reused across all subsequent queries touching those selections.

```
Source Trajectory: run.xtc
Topology File:     system.tpr

Sidecar Index:     run.mocs/
                   ├── manifest.json              # Level 0 Global Metadata & Index Hash
                   ├── source-map/
                   │   └── frame_offsets.bin      # Frame Index -> Byte Offset Table
                   ├── selections/                # Level 1 Selection Envelopes (O(M * s))
                   │   ├── a155_ca_01fa3b.bin     # AABB Block Records for Selection A
                   │   └── lig_o2_99ac21.bin      # AABB Block Records for Selection B
                   ├── cache/                     # Intermediate Observable Series & Views
                   └── certificates/              # Stored Execution Certificates (JSON)
```

---

## 2. Sidecar Directory Layout and Storage Formats

### 2.1 Level 0: The Manifest (`manifest.json`)

```json
{
  "mocs_version": "0.1.0",
  "created_at": "2026-09-12T18:00:00Z",
  "source": {
    "trajectory_path": "../run.xtc",
    "trajectory_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    "topology_path": "../system.tpr",
    "topology_sha256": "8f434346648f6b96df89dda901c5176b10f6d83961dd3c1ac88b59b2dc327aa4",
    "frame_count": 100000,
    "timestep_ps": 10.0,
    "atom_count": 52410
  },
  "pbc": {
    "mode": "orthorhombic_minimum_image",
    "box_dimensions_angstrom": [75.42, 75.42, 75.42]
  },
  "block_configuration": {
    "default_block_size": 100,
    "supported_block_sizes": [10, 25, 50, 100, 250, 500],
    "total_level0_blocks": 1000
  },
  "materialized_selections": [
    {
      "selection_id": "sel_A_155_CA",
      "selection_string": "A:155:CA",
      "atom_indices": [1245],
      "hash": "01fa3b827e44",
      "storage_file": "selections/a155_ca_01fa3b.bin"
    }
  ]
}
```

### 2.2 The Source Map (`source-map/frame_offsets.bin`) & Format Capability Matrix

To allow seeking to arbitrary temporal blocks without linearly reading sequential frames, the Level 0 builder constructs an immutable 64-bit binary seek table for variable-stride formats:

$$\text{Table Size} = N \times 8 \text{ bytes (where } N = \text{total frames)}$$

For a $100,000$-frame trajectory, this table occupies exactly $800\ \text{KB}$.

**Trajectory Reader Capability Matrix:**
| Trajectory Format | Compression | Frame Byte Stride | Random-Access Mechanism | Sidecar Offset Index Required? |
|:---|:---|:---|:---|:---:|
| **XTC (GROMACS)** | Lossy coordinate compression | Variable per frame | `frame_offsets.bin` binary seek table | **Yes** (constructed at Level 0 init) |
| **TRR (GROMACS)** | Uncompressed binary float32/float64 | Variable / fixed header | Binary seek table over frame headers | **Yes** |
| **DCD (CHARMM/NAMD)** | Uncompressed float32 | Fixed uniform byte stride | Direct mathematical $O(1)$ file seek | **No** (derived: $\text{offset}(k) = H + k \cdot S$) |

**Complexity Distinction ($O(1)$ Header vs. $O(N)$ Validation):**
* **Header Parsing ($O(1)$):** Inspecting file format, magic bytes, atom counts, and initial box dimensions is strictly $\mathcal{O}(1)$.
* **Full Trajectory Validation ($O(N)$):** Validating strict box dimension invariance ($< 0.1\%$ drift) and uniform timestep intervals ($\Delta t$) requires streaming frame headers across the entire file during Level 0 initialization. Once validated, results are cached in `manifest.json`.

---

## 3. Level 1: Selection Motion Records (Binary Layout)

When a selection is first referenced, the runtime streams the trajectory once, recording coordinate extrema for each temporal block into a dense binary file (`selections/<selection_id>.bin`).

### 3.1 C-Structure Definition for AABB Block Record

Each block in Level 1 is serialized as a **64-byte binary struct**:

```c
struct AABBBlockRecord {
    uint32_t block_id;             // Sequential block index (0, 1, 2, ...)  [4 bytes]
    uint32_t frame_start;          // Inclusive start frame index            [4 bytes]
    uint32_t frame_end;            // Exclusive end frame index              [4 bytes]
    uint32_t flags;                // Status flags (bit 0: crosses PBC)      [4 bytes]
    double   x_min;                // Coordinate extrema in Angstroms (f64)  [8 bytes]
    double   x_max;                //                                        [8 bytes]
    double   y_min;                //                                        [8 bytes]
    double   y_max;                //                                        [8 bytes]
    double   z_min;                //                                        [8 bytes]
    double   z_max;                //                                        [8 bytes]
}; // Total size: (4 * 4) + (6 * 8) = 16 + 48 = 64 bytes aligned
```

**Storage Overhead & Selection Envelope Invariant:**
MCI stores **selection envelopes** ($\mathcal{O}(M \cdot s)$), not pairwise combinations ($\mathcal{O}(M \cdot s^2)$). Pairwise distance bounds are computed on the fly in $\mathcal{O}(1)$ operations per block during query execution.
For a $100,000$-frame trajectory partitioned into $b=100$ frame blocks:
* $M = 1,000$ blocks.
* Per-selection index size: $1,000 \times 64\ \text{bytes} = 64\ \text{KB}$.
* A researcher querying $100$ residue pairs consumes only $\approx 6.4\ \text{MB}$ of index storage, which is $< 0.1\%$ of an $8\ \text{GB}$ trajectory. Pairwise bounds are never materialized on disk unless explicitly pinned in `cache/` as an intermediate view.

### 3.2 Canonical Index Hashing and Atomic Persistence Protocol

1. **Canonical MCI Hash (`mci_index_hash`):**
   The cryptographic commitment of an MCI directory is computed as:
   $$\operatorname{MCI\_HASH} = \operatorname{SHA256}(\operatorname{CanonicalJSON}(\text{manifest}) \,\|\, \operatorname{SHA256}(B_1) \,\|\, \dots \,\|\, \operatorname{SHA256}(B_s))$$
   where selection binary files $B_1, \dots, B_s$ are hashed in alphanumeric order of their normalized filenames, and `manifest.json` is serialized with sorted keys, 2-space indentation, and forward slashes.
2. **Transactional Write Atomicity & Crash Recovery:**
   * All binary selection files are initially written to temporary files: `selections/<id>.bin.tmp`.
   * After streaming coordinates and flushing buffers with `fsync()`, the file is atomically renamed to `selections/<id>.bin` using `os.replace()`.
   * `manifest.json` is committed only after all referenced selection files have been atomically committed.
   * If a process crashes mid-build, any surviving `.tmp` files are detected on subsequent session initialization and purged before execution proceeds.

---

## 4. Query Execution Without Reading Raw Frames

Consider the query:

$$\operatorname{CONTACT}(\text{A:155:CA}, \text{LIG:1:O2}, \text{cutoff} = 4.0\ \text{Å})$$

The MCI resolves this query across the trajectory using the following algorithm:

```
For each Block m in 0 .. M-1:
  1. Read Record A_m from selections/a155_ca.bin  (Seek: m * 64 bytes)
  2. Read Record B_m from selections/lig_o2.bin   (Seek: m * 64 bytes)
  
  3. Derive 1D Interval Separations under PBC:
     For each dimension mu in {x, y, z}:
        dx_min, dx_max = compute_pbc_interval_separation(A_m, B_m, Box_mu)
  
  4. Compute Conservative Bounds:
     L_m = sqrt(dx_min^2 + dy_min^2 + dz_min^2)
     U_m = sqrt(dx_max^2 + dy_max^2 + dz_max^2)
  
  5. Apply Certification Conditions:
     IF U_m < 4.0 A:
        Status(m) = CERTIFIED_TRUE   -> [Pruned: Entire block is in contact]
     ELSE IF L_m >= 4.0 A:
        Status(m) = CERTIFIED_FALSE  -> [Pruned: Entire block is NOT in contact]
     ELSE:
        Status(m) = UNKNOWN          -> [Queue Block m for Refinement / Exact Scan]
```

### 4.1 Quantitative Example

Suppose for Block 42 ($100$ frames):
* $L_{42} = 5.82\ \text{Å}$, $U_{42} = 7.14\ \text{Å}$.
* Query asks: $\text{distance} < 4.0\ \text{Å}$.
* Since $L_{42} \ge 4.0\ \text{Å}$, MOCS marks Block 42 as `CERTIFIED_FALSE`.
* **Zero coordinate bytes are read from disk for Block 42.** All $100$ frames are safely discarded based entirely on the 128 bytes read from the Level 1 index.

---

## 5. Hierarchical Block Refinement Protocol

When $L_m < \theta \le U_m$, Block $m$ is ambiguous (`UNKNOWN`). MOCS-Cert resolves this ambiguity through a 4-level hierarchy:

```
Level 0: Coarse Block (b = 500 frames) ──► Fast Pruning Filter
   │
   ▼ (Subdivide if UNKNOWN)
Level 1: Medium Block (b = 100 frames) ──► Tighter AABB Envelopes
   │
   ▼ (Subdivide if UNKNOWN)
Level 2: Fine Block   (b = 25 frames)  ──► Highly Constrained Motion
   │
   ▼ (Subdivide if UNKNOWN)
Level 3: Exact Frame Scan (b = 1 frame) ─► Brute-Force Coordinate Verification
```

### 5.1 Refinement Termination Conditions
The refinement loop terminates when:
1. The sub-block bounds contract sufficiently such that $U < \theta$ (`CERTIFIED_TRUE`) or $L \ge \theta$ (`CERTIFIED_FALSE`).
2. The sub-block reaches single-frame granularity (Level 3), where $L \equiv U \equiv d_{\text{exact}}$, guaranteeing an unambiguous Boolean result.
3. The query contract's refinement resource budget is reached, returning `UNKNOWN` for that interval.

---

## 6. Index Invalidation and Cache Consistency

The MCI operates under a **Fail-Closed Stale Index Policy**. An index is immediately invalidated if any prerequisite component drifts:

### 6.1 Invalidation Trigger Table
 
 | Invalidation Event | Detection Mechanism | Recovery Action |
 |---|---|---|
 | **Trajectory file modified or replaced** | Fast check (file size, mtime, inode) fails, or full forensic SHA-256 mismatch against `manifest.source.trajectory_sha256` | Wipe sidecar directory; force complete rebuild. |
 | **Topology file modified** | Fast check (mtime, size) fails, or SHA-256 mismatch against `manifest.source.topology_sha256` | Invalidate all Level 1 selections; rebuild selections. |
 | **MOCS compiler version updated** | Semantic version increment in `manifest.mocs_version` | Run differential test suite; if layout unchanged, upgrade manifest. |
 | **Selection definition altered** | Atom count / index divergence in selection record | Invalidate and recompute specific selection `.bin` file. |
 | **Corrupted binary record** | NaN coordinate or frame count mismatch in `AABBBlockRecord` | Raise fatal `MOCSIndexCorruptedError`; trigger targeted rebuild. |

### 6.2 Two-Tier Identity Verification Architecture
To avoid hashing multi-gigabyte trajectories on every query (which would negate all I/O pruning gains):
* **Tier 1 (Runtime Fast Check):** The runtime inspects file metadata (file size in bytes, last modified timestamp `mtime`, and filesystem inode / file ID). If these match the cached manifest entry, the cached source digest is trusted.
* **Tier 2 (Forensic Cryptographic Verification):** A full SHA-256 hash stream of the entire source trajectory file is executed only during index initialization, explicit `--verify-provenance` CLI invocations, or when Tier 1 metadata indicates a modification.
