# MOCS-Cert Scientific Backend Architecture
## Multi-Engine Orchestration, Process Boundaries & Execution Isolation

---

## 1. Engine Separation & Execution Boundaries

MOCS-Cert decouples scientific computation into isolated architectural layers:

```
[ FastAPI / Backend Core ]
         |
         +---> [ In-Process Adapters ] (ProLIF, Gemmi, Biopython, RDKit, NumPy)
         |
         +---> [ Process Worker Boundary ] (P2Rank, fpocket, AutoDock Vina, smina)
         |
         +---> [ Copyleft Subprocess Boundary ] (Foldseek, MMseqs2)
         |
         +---> [ Differential Reference Oracle ] (MDAnalysis, PLIP)
```

---

## 2. Invariant Contracts

1. **Fail-Closed on Missing Binaries:** When an external tool is absent from PATH or the Python virtualenv, the adapter immediately reports `is_available() == False` and returns structured `NOT INSTALLED` metadata without raising unhandled crashes.
2. **Immutable Provenance Nodes:** Every calculation emits a `WorkflowProvenanceNode` recording input SHA-256, tool version, execution timestamp, parameters, and scientific limitations.
3. **No Coordinate Averaging:** The consensus prediction engine aligns structural models via Kabsch superposition but preserves individual atomic coordinates.
