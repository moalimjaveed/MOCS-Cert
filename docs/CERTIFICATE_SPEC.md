# CERTIFICATE_SPEC.md — MOCS-Cert Execution Certificate Specification

**Status:** V0.1.0 Design Baseline (Audit Revisions Applied)
**Version:** 0.1.0 / Design Baseline (Audit Revisions Applied)  
**Canonical Owner:** `CERTIFICATE_SPEC.md` is the authoritative specification for JSON execution certificate schemas, two-tier trust verification algorithms, and provenance bindings in MOCS-Cert. Tracked in [`DOC_MANIFEST.yaml`](../DOC_MANIFEST.yaml).

---

## 1. Executive Summary & Trust Model

A MOCS-Cert Execution Certificate is a machine-readable JSON record generated upon query completion. It establishes computational provenance by recording the query specification, mathematical bounds, source file identities, MCI index commitments, and compiler execution paths that produced the result.

### 1.1 Two-Tier Trust Model (Design Baseline Definition)

A fundamental architectural correction established in V0.1 is that an execution certificate is:

> **An execution certificate relative to a trusted, content-addressed source trajectory and MCI sidecar index**, rather than an ungrounded, standalone self-proving mathematical proof.

The certificate achieves verification through a two-tier integrity architecture:
* **Tier 1 (Execution & Derivation Verification):** Verifies that the recorded logical truth and resolution status were soundly derived from the referenced index bounds, exact frames, and query operators under the declared contract.
* **Tier 2 (Index & Source Commitment):** Binds the execution certificate to explicit cryptographic hashes of both the source files ($H(T), H(\Phi)$) and the MCI index sidecar ($H(\text{MCI})$), along with compiler schema and algorithm versions.

Independent mathematical verification that index bounds themselves are sound from raw coordinates without re-reading frames is achieved through index consistency checks and deterministic re-computation policies.

---

## 2. Epistemic Scope: What Is and Is Not Certified

### 2.1 What Is Formally Certified

A certificate attests strictly to the following mathematical assertion:

$$\mathcal{P}_{\text{query}}(T) \equiv (\text{Truth}, \text{Resolution}) \quad \text{under contract } \mathcal{C} = (Q, \epsilon, \tau, \text{policy})$$

Specifically, it certifies:
1. **Deductive Soundness:** The recorded logical truth (`TRUE`, `FALSE`, or `UNKNOWN`) and execution resolution status (`COMPLETE`, `NEEDS_REFINEMENT`, `UNRESOLVABLE_SAMPLING`, `UNSUPPORTED_GEOMETRY`, `UNSUPPORTED_SEMANTICS`, or `ERROR`) follow deductively from the inspected evidence blocks and exact frame scans.
2. **Data-Level Determinism:** Given identical source trajectory bytes $H(T)$, topology bytes $H(\Phi)$, index commitment $H(\text{MCI})$, operator versions, and numerical policy, any conforming verifier will derive the exact same logical conclusion.
3. **Execution Transparency:** Every block evaluated via index bounds vs. exact coordinate scanning is explicitly itemized in the evidence record.

### 2.2 What Is Explicitly NOT Certified

A MOCS-Cert certificate does **not** certify:
* **Physical Reality:** It does not assert that the physical biological molecule adopts the queried conformation.
* **Force-Field Accuracy:** It does not validate whether the molecular dynamics integrator, potential function, or parameterization is physically sound.
* **Thermodynamic Convergence:** It does not certify that the trajectory has reached statistical equilibrium or adequately sampled phase space.
* **Continuous-Time Persistence:** In V0.1, it certifies statements strictly over observed, sampled frames; it makes no claims regarding unobserved inter-frame states.

---

## 3. Certificate Lifecycle and Verification Architecture

```
[User Query + Contract C]
           │
           ▼
[Certified Runtime Execution]
           │
           ├─► Reads MCI Index Blocks (Bounds: L, U) bound to H(MCI)
           ├─► Performs Selective Refinement on UNKNOWN blocks
           └─► Reads Exact Frames (when necessary)
           │
           ▼
[Certificate Generation] ──► Produces JSON Certificate
           │
           ▼
[Standalone Verifier (mocs verify)]
           ├─► Validates Source & Index Commitments (Tier 1 Fast or Tier 2 Forensic)
           ├─► Validates Semantic Parameter Preconditions
           ├─► Verifies Mathematical Sufficiency (operator-branching check)
           └─► Emits: VALID / INVALID
```

---

## 4. Formal JSON Schema (Draft 2020-12 Conforming)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mocs-cert.org/schemas/v0.1/certificate.json",
  "title": "MOCSCertificate",
  "type": "object",
  "required": [
    "schema_version",
    "certificate_id",
    "timestamp_iso8601",
    "result",
    "query",
    "semantics",
    "source",
    "index_commitment",
    "evidence",
    "resources",
    "compiler"
  ],
  "properties": {
    "schema_version": { "type": "string", "enum": ["0.1.0"] },
    "certificate_id": { "type": "string", "format": "uuid" },
    "timestamp_iso8601": { "type": "string", "format": "date-time" },
    "result": {
      "type": "object",
      "required": ["truth", "resolution", "quantifier"],
      "properties": {
        "truth": { "type": "string", "enum": ["TRUE", "FALSE", "UNKNOWN"] },
        "resolution": {
          "type": "string",
          "enum": [
            "COMPLETE",
            "NEEDS_REFINEMENT",
            "UNRESOLVABLE_SAMPLING",
            "UNSUPPORTED_GEOMETRY",
            "UNSUPPORTED_SEMANTICS",
            "ERROR"
          ]
        },
        "quantifier": { "type": "string", "enum": ["EXISTS", "FORALL", "DURATION"] }
      }
    },
    "query": {
      "type": "object",
      "required": ["observable", "operands", "predicate"],
      "properties": {
        "observable": { "type": "string", "enum": ["DISTANCE", "CONTACT", "HBOND"] },
        "operands": {
          "type": "object",
          "properties": {
            "atom_a": { "type": "string" },
            "atom_b": { "type": "string" },
            "donor": { "type": "string" },
            "hydrogen": { "type": "string" },
            "acceptor": { "type": "string" }
          }
        },
        "predicate": {
          "type": "object",
          "required": ["operator", "threshold_value", "threshold_unit"],
          "properties": {
            "operator": { "type": "string", "enum": ["<", "<=", ">", ">="] },
            "threshold_value": { "type": "number" },
            "threshold_unit": { "type": "string", "enum": ["angstrom", "degrees", "ps"] }
          }
        },
        "temporal": {
          "type": ["object", "null"],
          "properties": {
            "operator": { "type": "string", "enum": ["FOR", "BEFORE", "AFTER", "FOLLOWED_BY", "WITHIN"] },
            "min_duration_ps": { "type": "number" },
            "window_ps": { "type": ["number", "null"] }
          }
        }
      }
    },
    "semantics": {
      "type": "object",
      "required": ["pbc_mode", "numerical_policy", "sampling_semantics"],
      "properties": {
        "pbc_mode": { "type": "string", "enum": ["orthorhombic_minimum_image", "non_periodic"] },
        "box_dimensions_angstrom": {
          "type": "array",
          "items": { "type": "number" },
          "minItems": 3,
          "maxItems": 3
        },
        "numerical_policy": {
          "type": "object",
          "required": ["precision", "rounding", "epsilon_distance_angstrom"],
          "properties": {
            "precision": { "type": "string", "enum": ["float64"] },
            "rounding": { "type": "string", "enum": ["round_to_nearest_even"] },
            "epsilon_distance_angstrom": { "type": "number" }
          }
        },
        "sampling_semantics": {
          "type": "object",
          "required": ["mode", "dt_ps", "total_frames"],
          "properties": {
            "mode": { "type": "string", "enum": ["sampled_frames"] },
            "dt_ps": { "type": "number" },
            "total_frames": { "type": "integer" }
          }
        }
      }
    },
    "source": {
      "type": "object",
      "required": ["trajectory_sha256", "topology_sha256", "trajectory_filename", "topology_filename", "trajectory_size_bytes"],
      "properties": {
        "trajectory_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "topology_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "trajectory_filename": { "type": "string" },
        "topology_filename": { "type": "string" },
        "trajectory_size_bytes": { "type": "integer" }
      }
    },
    "index_commitment": {
      "type": "object",
      "required": ["mci_index_hash", "algorithm_version", "selection_hashes"],
      "properties": {
        "mci_index_hash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
        "algorithm_version": { "type": "string" },
        "selection_hashes": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "evidence": {
      "type": "object",
      "required": ["total_blocks", "blocks_certified_true", "blocks_certified_false", "blocks_refined", "frames_scanned_exact", "inspected_block_bounds"],
      "properties": {
        "total_blocks": { "type": "integer" },
        "blocks_certified_true": { "type": "integer" },
        "blocks_certified_false": { "type": "integer" },
        "blocks_refined": { "type": "integer" },
        "frames_scanned_exact": { "type": "integer" },
        "inspected_block_bounds": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["block_id", "frame_range", "lower_bound", "upper_bound", "status"],
            "properties": {
              "block_id": { "type": "integer" },
              "frame_range": {
                "type": "array",
                "items": { "type": "integer" },
                "minItems": 2,
                "maxItems": 2,
                "description": "Half-open frame range [start, end)"
              },
              "lower_bound": { "type": "number" },
              "upper_bound": { "type": "number" },
              "status": { "type": "string", "enum": ["CERTIFIED_TRUE", "CERTIFIED_FALSE", "UNKNOWN"] }
            }
          }
        }
      }
    },
    "resources": {
      "type": "object",
      "required": [
        "source_compressed_bytes_fetched",
        "coordinate_payload_bytes",
        "compressed_frames_decoded",
        "coordinates_materialized",
        "atoms_analyzed",
        "index_bytes_read",
        "wall_time_seconds"
      ],
      "properties": {
        "source_compressed_bytes_fetched": { "type": ["integer", "null"] },
        "coordinate_payload_bytes": { "type": "integer" },
        "compressed_frames_decoded": { "type": "integer" },
        "coordinates_materialized": { "type": "integer" },
        "atoms_analyzed": { "type": "integer" },
        "index_bytes_read": { "type": "integer" },
        "wall_time_seconds": { "type": "number" },
        "peak_memory_bytes": { "type": "integer" }
      }
    },
    "compiler": {
      "type": "object",
      "required": ["mocs_version", "git_commit", "execution_plan_id", "operator_version"],
      "properties": {
        "mocs_version": { "type": "string" },
        "git_commit": { "type": "string" },
        "execution_plan_id": { "type": "string" },
        "operator_version": { "type": "string" }
      }
    }
  }
}
```

---

## 5. Concrete Certificate Example (V0.1 Format)

```json
{
  "schema_version": "0.1.0",
  "certificate_id": "e7b8c381-42a1-4cf1-8c43-26f54b68e910",
  "timestamp_iso8601": "2026-09-12T18:30:00Z",
  "result": {
    "truth": "TRUE",
    "resolution": "COMPLETE",
    "quantifier": "EXISTS"
  },
  "query": {
    "observable": "CONTACT",
    "operands": {
      "atom_a": "A:155:CA",
      "atom_b": "LIG:1:O2"
    },
    "predicate": {
      "operator": "<",
      "threshold_value": 4.0,
      "threshold_unit": "angstrom"
    },
    "temporal": {
      "operator": "FOR",
      "min_duration_ps": 100.0,
      "window_ps": null
    }
  },
  "semantics": {
    "pbc_mode": "orthorhombic_minimum_image",
    "box_dimensions_angstrom": [75.42, 75.42, 75.42],
    "numerical_policy": {
      "precision": "float64",
      "rounding": "round_to_nearest_even",
      "epsilon_distance_angstrom": 1e-6
    },
    "sampling_semantics": {
      "mode": "sampled_frames",
      "dt_ps": 10.0,
      "total_frames": 100000
    }
  },
  "source": {
    "trajectory_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    "topology_sha256": "8f434346648f6b96df89dda901c5176b10f6d83961dd3c1ac88b59b2dc327aa4",
    "trajectory_filename": "md_production_1us.xtc",
    "topology_filename": "system_solvated.tpr",
    "trajectory_size_bytes": 8589934592
  },
  "index_commitment": {
    "mci_index_hash": "6a8f192b0c44de884b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb0",
    "algorithm_version": "AABB-v1.0",
    "selection_hashes": {
      "A:155:CA": "01fa3b827e44",
      "LIG:1:O2": "99ac21df88bc"
    }
  },
  "evidence": {
    "total_blocks": 1000,
    "blocks_certified_true": 820,
    "blocks_certified_false": 150,
    "blocks_refined": 30,
    "frames_scanned_exact": 3000,
    "inspected_block_bounds": [
      {
        "block_id": 0,
        "frame_range": [0, 100],
        "lower_bound": 2.84,
        "upper_bound": 3.65,
        "status": "CERTIFIED_TRUE"
      },
      {
        "block_id": 1,
        "frame_range": [100, 200],
        "lower_bound": 5.12,
        "upper_bound": 6.88,
        "status": "CERTIFIED_FALSE"
      }
    ]
  },
  "resources": {
    "source_compressed_bytes_fetched": 257698037,
    "compressed_frames_decoded": 3000,
    "coordinates_materialized": 18000,
    "atoms_analyzed": 2,
    "index_bytes_read": 64000,
    "wall_time_seconds": 1.842,
    "peak_memory_bytes": 134217728
  },
  "compiler": {
    "mocs_version": "0.1.0",
    "git_commit": "c4b189df0b62e49d6824a7cf52a441e97d762e81",
    "execution_plan_id": "Plan-D",
    "operator_version": "CONTACT-v1"
  }
}
```

---

## 6. Standalone Certificate Verification Algorithm

A verification program (`mocs verify <certificate.json>`) evaluates certificate validity and soundness.

### 6.1 Two-Tier Source Identity Verification

To prevent sequential re-reading of multi-gigabyte trajectories on every routine verification while maintaining forensic trust:
* **Fast Mode (Default):** Checks trajectory and topology file size and modification timestamps (`mtime`). If identical to the recorded provenance metadata, the cached SHA-256 is accepted.
* **Forensic Mode (`--forensic`):** Performs a streaming SHA-256 re-computation of the source trajectory and topology files and compares against `cert["source"]["trajectory_sha256"]` and `cert["source"]["topology_sha256"]`.

### 6.2 Complete Standalone Verifier Pseudocode

```python
class VerificationError(Exception):
    pass

def verify_certificate(
    cert: dict, 
    trajectory_path: str, 
    topology_path: str, 
    forensic: bool = False
) -> bool:
    # 1. Schema Validation
    validate_schema(cert)

    # 2. Source and MCI Commitments
    if forensic:
        traj_hash = compute_sha256(trajectory_path)
        topo_hash = compute_sha256(topology_path)
        if traj_hash != cert["source"]["trajectory_sha256"]:
            raise VerificationError("Forensic Error: Trajectory SHA-256 digest mismatch.")
        if topo_hash != cert["source"]["topology_sha256"]:
            raise VerificationError("Forensic Error: Topology SHA-256 digest mismatch.")
        if mci_path:
            mci_hash = compute_mci_canonical_hash(mci_path)
            if mci_hash != cert["index_commitment"].get("mci_index_hash", cert["index_commitment"].get("mci_sha256")):
                raise VerificationError("Forensic Error: MCI sidecar hash commitment mismatch.")
    else:
        # Fast metadata check
        if get_file_size(trajectory_path) != cert["source"]["trajectory_size_bytes"]:
            raise VerificationError("Fast Check Error: Trajectory file size mismatch.")

    # 3. Predicate Operator and Mathematical Sufficiency Check
    pred = cert["query"]["predicate"]
    op = pred["operator"]
    threshold = pred["threshold_value"]

    proof = cert.get("proof", {})
    proof_type = proof.get("type")
    witness_blocks = proof.get("witness_blocks") or cert.get("evidence", {}).get("inspected_block_bounds", [])

    for block in witness_blocks:
        L = block["lower_bound"]
        U = block["upper_bound"]
        status = block.get("status") or block.get("truth_value")
        b_id = block["block_id"]

        if op == "<":
            if status in ("TRUE", "CERTIFIED_TRUE") and not (U < threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=TRUE but U={U} >= {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not (L >= threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=FALSE but L={L} < {threshold}")
        elif op == "<=":
            if status in ("TRUE", "CERTIFIED_TRUE") and not (U <= threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=TRUE but U={U} > {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not (L > threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=FALSE but L={L} <= {threshold}")
        elif op == ">":
            if status in ("TRUE", "CERTIFIED_TRUE") and not (L > threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=TRUE but L={L} <= {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not (U <= threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=FALSE but U={U} > {threshold}")
        elif op == ">=":
            if status in ("TRUE", "CERTIFIED_TRUE") and not (L >= threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=TRUE but L={L} < {threshold}")
            if status in ("FALSE", "CERTIFIED_FALSE") and not (U < threshold):
                raise VerificationError(f"Soundness violation in Block {b_id}: status=FALSE but U={U} >= {threshold}")
        else:
            raise VerificationError(f"Unsupported predicate operator: {op}")

    # 4. Query-Level Quantifier & Coverage Verification
    quantifier = cert["result"].get("quantifier")
    truth = cert["result"]["truth"]

    if quantifier == "EXISTS":
        if truth == "TRUE":
            # At least one witness block or exact frame must be TRUE
            has_true_witness = any(b.get("status") in ("TRUE", "CERTIFIED_TRUE") for b in witness_blocks)
            if not has_true_witness and cert["evidence"].get("frames_evaluated_exact", 0) == 0:
                raise VerificationError("Existential query certified TRUE without verified witness.")
        elif truth == "FALSE":
            # Exhaustive negation requires complete coverage without gaps
            cov = proof.get("coverage")
            if not cov or not cov.get("complete") or not cov.get("no_gaps"):
                raise VerificationError("Exhaustive negation requires verified complete partition coverage.")
            has_non_false = any(b.get("status") not in ("FALSE", "CERTIFIED_FALSE") for b in witness_blocks)
            if has_non_false:
                raise VerificationError("Exhaustive negation contains non-FALSE block.")
    elif quantifier == "FORALL":
        if truth == "TRUE":
            cov = proof.get("coverage")
            if not cov or not cov.get("complete") or not cov.get("no_gaps"):
                raise VerificationError("Universal query requires verified complete partition coverage.")
            if any(b.get("status") not in ("TRUE", "CERTIFIED_TRUE") for b in witness_blocks):
                raise VerificationError("Universal query contains non-TRUE block.")
    elif quantifier == "DURATION":
        temp = cert["query"].get("temporal")
        if temp and temp.get("operator") == "FOR":
            min_dur = temp["min_duration_ps"]
            dt = cert["semantics"]["sampling_semantics"]["dt_ps"]
            mode = cert["semantics"]["sampling_semantics"].get("mode", "sampled_frames")
            if mode == "continuous_physical":
                raise VerificationError("Continuous physical persistence is outside V0.1 capability.")
            if truth == "TRUE":
                # Verify that witness blocks form a strictly contiguous run of at least ceil(min_dur / dt) frames
                req_frames = max(1, int(math.ceil(min_dur / dt)))
                intervals = []
                for b in witness_blocks:
                    if b.get("status") in ("TRUE", "CERTIFIED_TRUE"):
                        s = b.get("frame_start")
                        e = b.get("frame_end_exclusive")
                        if s is not None and e is not None and e > s:
                            intervals.append((s, e))

                if not intervals and cert["evidence"].get("frames_evaluated_exact", 0) >= req_frames:
                    # Verified by exact frame evaluation
                    pass
                else:
                    if not intervals:
                        raise VerificationError("Duration query TRUE requires verified witness blocks or frames.")
                    intervals.sort(key=lambda x: x[0])

                    max_contiguous_frames = 0
                    current_run_frames = intervals[0][1] - intervals[0][0]
                    prev_end = intervals[0][1]

                    for s, e in intervals[1:]:
                        if s == prev_end:
                            # Strictly contiguous: no gap, no overlap
                            current_run_frames += (e - s)
                            prev_end = e
                        elif s < prev_end:
                            raise VerificationError(f"Overlapping witness intervals detected: [{s}, {e}) overlaps previous end {prev_end}.")
                        else:
                            # Gap detected: evaluate completed run and start new run
                            if current_run_frames > max_contiguous_frames:
                                max_contiguous_frames = current_run_frames
                            current_run_frames = e - s
                            prev_end = e

                    if current_run_frames > max_contiguous_frames:
                        max_contiguous_frames = current_run_frames

                    if max_contiguous_frames < req_frames:
                        raise VerificationError(
                            f"Duration proof violates contiguity: max contiguous run is {max_contiguous_frames} frames "
                            f"({max_contiguous_frames * dt} ps), but query requires {req_frames} frames ({min_dur} ps)."
                        )

    return True
```

---

## 7. Certificate Invalidation Rules

A previously issued certificate is immediately and irrevocably rendered invalid if:
1. **Source File Mutation:** File size or SHA-256 digest diverges from recorded source metadata.
2. **Index Commitment Mismatch:** The MCI sidecar hash or selection hashes do not match `index_commitment.mci_index_hash`.
3. **Operator Deprecation:** An operator version increment (e.g. `CONTACT-v1` $\to$ `CONTACT-v2`) invalidates previous derivations.
4. **PBC Parameter Drift:** Simulation cell dimensions recorded in the certificate diverge from the source metadata.
