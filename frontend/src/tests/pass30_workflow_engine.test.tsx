// @vitest-environment jsdom
/**
 * frontend/src/tests/pass30_workflow_engine.test.tsx
 * PASS 30 — Scientific Workflow Engine Frontend Test Suite (20 tests)
 *
 * Uses the same createRoot + act pattern as all existing MOCS-Cert tests.
 * No @testing-library/react dependency needed.
 */

import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, Root } from "react-dom/client";

import { BackendDiscoveryMatrix } from "../components/views/BackendDiscoveryMatrix";
import { ProvenanceGraphViewer } from "../components/views/ProvenanceGraphViewer";
import { LineageQueryInspector } from "../components/views/LineageQueryInspector";
import { WorkflowOrchestrationView } from "../components/views/WorkflowOrchestrationView";

import type {
  BackendStatusRecord,
  ProvenanceGraph,
  LineageReport,
} from "../workflow/types";

// ─── React 19 act environment ─────────────────────────────────────────────────
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ─── Mock fetch globally ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => "",
    })
  );
});

// ─── DOM helpers ──────────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  document.body.removeChild(container);
  vi.unstubAllGlobals();
});

function q(selector: string): Element | null {
  return container.querySelector(selector);
}
function qAll(selector: string): NodeListOf<Element> {
  return container.querySelectorAll(selector);
}
function text(): string {
  return container.textContent ?? "";
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockBackends: BackendStatusRecord[] = [
  {
    backend_id: "mocs",
    name: "Native MOCS-Cert",
    role: "Certified Temporal Trajectory Compiler & Verifier",
    state: "AVAILABLE",
    version: "0.1.0",
    license: "Apache-2.0",
    citation: "MOCS-Cert (2026)",
    smoke_test_passed: true,
    smoke_test_latency_ms: 1.2,
    capabilities: ["certified_pruning", "conservative_pbc_bounds"],
    limitations: ["orthorhombic only"],
  },
  {
    backend_id: "rdkit",
    name: "RDKit",
    role: "Cheminformatics Adapter",
    state: "UNAVAILABLE",
    version: "unknown",
    license: "BSD-3-Clause",
    citation: "RDKit (2023)",
    smoke_test_passed: false,
    smoke_test_latency_ms: 0,
    capabilities: [],
    limitations: ["not installed"],
    error_message: "No module named 'rdkit'",
  },
  {
    backend_id: "bad_backend",
    name: "Bad Backend",
    role: "Failing smoke test",
    state: "FAILED_SELF_TEST",
    version: "1.0",
    license: "MIT",
    citation: "Test",
    smoke_test_passed: false,
    smoke_test_latency_ms: 5.0,
    capabilities: [],
    limitations: [],
    error_message: "assertion failed",
  },
];

const mockGraph: ProvenanceGraph = {
  workflow_id: "wf-test-001",
  nodes: [
    { node_id: "step-ingest",  node_type: "STEP",     label: "INGEST" },
    { node_id: "art-struct",   node_type: "ARTIFACT", label: "STRUCTURE art-struct" },
    { node_id: "step-analyze", node_type: "STEP",     label: "ANALYZE" },
    { node_id: "art-cert",     node_type: "ARTIFACT", label: "CERTIFICATE art-cert" },
  ],
  edges: [
    { from_node: "step-ingest",  to_node: "art-struct",   relation: "PRODUCES" },
    { from_node: "art-struct",   to_node: "step-analyze", relation: "CONSUMES" },
    { from_node: "step-analyze", to_node: "art-cert",     relation: "PRODUCES" },
  ],
  artifacts: {},
  steps: [],
};

const mockLineage: LineageReport = {
  target_artifact_id: "art-cert-xyz-0001",
  causal_chain: [
    "step-ingest: Load 4HHB",
    "step-select: Pick Fe atom",
    "step-analyze: Compute bond",
  ],
  ancestors: ["art-struct-abc", "art-selection-def"],
  oracle_info: {
    reference_backend: "MDAnalysis",
    absolute_difference: 0.0,
    classification: "WITHIN_TOLERANCE",
    certificate_digest: "abc123def456789012345678901234567890abcd",
  },
};

// ─── WorkflowOrchestrationView ────────────────────────────────────────────────

describe("WorkflowOrchestrationView", () => {
  it("1. renders without crash and shows testid", () => {
    act(() => { root.render(<WorkflowOrchestrationView />); });
    expect(q('[data-testid="workflow-orchestration-view"]')).not.toBeNull();
  });

  it("2. shows 'Backend Discovery Matrix' section heading", () => {
    act(() => { root.render(<WorkflowOrchestrationView />); });
    expect(text()).toContain("Backend Discovery Matrix");
  });

  it("3. shows 'Scientific Workflow Execution' section heading", () => {
    act(() => { root.render(<WorkflowOrchestrationView />); });
    expect(text()).toContain("Scientific Workflow Execution");
  });

  it("4. shows all 3 workflow card testids", () => {
    act(() => { root.render(<WorkflowOrchestrationView />); });
    expect(q('[data-testid="workflow-card-4hhb"]')).not.toBeNull();
    expect(q('[data-testid="workflow-card-1bna"]')).not.toBeNull();
    expect(q('[data-testid="workflow-card-synth_500f"]')).not.toBeNull();
  });

  it("5. 'Provenance & Lineage' section heading present", () => {
    act(() => { root.render(<WorkflowOrchestrationView />); });
    expect(text()).toContain("Provenance & Lineage");
  });
});

// ─── BackendDiscoveryMatrix ───────────────────────────────────────────────────

describe("BackendDiscoveryMatrix", () => {
  it("6. renders all three backend names", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    expect(text()).toContain("Native MOCS-Cert");
    expect(text()).toContain("RDKit");
    expect(text()).toContain("Bad Backend");
  });

  it("7. latency shown for passing smoke test (1.2 ms)", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    expect(text()).toContain("1.2 ms");
  });

  it("8. FAILED_SELF_TEST badge text appears", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    // Badge renders state with single underscore replacement: "FAILED SELF_TEST"
    expect(text()).toContain("FAILED SELF_TEST");
  });

  it("9. summary strip shows correct total count", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    expect(text()).toContain("3 backends");
  });

  it("10. summary strip shows available count", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    expect(text()).toContain("1 available");
  });

  it("11. empty state message when no backends provided", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={[]} />); });
    expect(text()).toContain("No backends discovered.");
  });

  it("12. table has aria-label for accessibility", () => {
    act(() => { root.render(<BackendDiscoveryMatrix backends={mockBackends} />); });
    const table = q('table[aria-label="Backend discovery matrix"]');
    expect(table).not.toBeNull();
  });
});

// ─── ProvenanceGraphViewer ────────────────────────────────────────────────────

describe("ProvenanceGraphViewer", () => {
  it("13. empty graph shows fallback message", () => {
    const emptyGraph: ProvenanceGraph = {
      workflow_id: "empty",
      nodes: [],
      edges: [],
      artifacts: {},
      steps: [],
    };
    act(() => { root.render(<ProvenanceGraphViewer graph={emptyGraph} />); });
    expect(text()).toContain("No provenance data available.");
  });

  it("14. SVG element rendered for non-empty graph", () => {
    act(() => { root.render(<ProvenanceGraphViewer graph={mockGraph} />); });
    expect(q("svg")).not.toBeNull();
  });

  it("15. SVG aria-label set to 'Workflow provenance DAG'", () => {
    act(() => { root.render(<ProvenanceGraphViewer graph={mockGraph} />); });
    const svg = q('svg[aria-label="Workflow provenance DAG"]');
    expect(svg).not.toBeNull();
  });

  it("16. step labels appear inside SVG text elements", () => {
    act(() => { root.render(<ProvenanceGraphViewer graph={mockGraph} />); });
    const svgHtml = q("svg")?.innerHTML ?? "";
    expect(svgHtml).toContain("INGEST");
    expect(svgHtml).toContain("ANALYZE");
  });
});

// ─── LineageQueryInspector ────────────────────────────────────────────────────

describe("LineageQueryInspector", () => {
  it("17. renders target artifact ID", () => {
    act(() => { root.render(<LineageQueryInspector report={mockLineage} />); });
    expect(text()).toContain("art-cert-xyz-0001");
  });

  it("18. causal chain steps all present", () => {
    act(() => { root.render(<LineageQueryInspector report={mockLineage} />); });
    expect(text()).toContain("step-ingest: Load 4HHB");
    expect(text()).toContain("step-select: Pick Fe atom");
    expect(text()).toContain("step-analyze: Compute bond");
  });

  it("19. oracle verdict badge shows WITHIN TOLERANCE", () => {
    act(() => { root.render(<LineageQueryInspector report={mockLineage} />); });
    expect(text()).toContain("WITHIN TOLERANCE");
  });

  it("20. oracle absolute difference formatted to 4 decimal places", () => {
    act(() => { root.render(<LineageQueryInspector report={mockLineage} />); });
    expect(text()).toContain("0.0000");
  });
});
