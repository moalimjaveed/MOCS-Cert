# Method Specification: Benchmark Split & Leakage Protection
## Method ID: METH-009

### 1. Scientific Overview
Prevents inflated performance claims on structural biology ML benchmarks (ProteinNet, SidechainNet, PDBBind):
- Temporal cutoff date filtering
- Sequence identity clustering ($< 30\%$) to test set
