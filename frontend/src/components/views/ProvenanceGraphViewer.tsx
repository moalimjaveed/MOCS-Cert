/**
 * ProvenanceGraphViewer.tsx
 * PASS 30 / Scientific Workflow Provenance DAG Visualizer
 *
 * Renders a restrained technical SVG lineage graph:
 *   Steps     → rounded-rect nodes (Fluent Light surface)
 *   Artifacts → circle nodes color-coded by kind
 *   Edges     → directional paths with SVG arrowheads
 *
 * Pure Fluent Light workstation design:
 *   - Clean #FAFAFA / #FFFFFF canvas with subtle #E5E5E5 border
 *   - Darker text #1C1C1C for maximum readability
 *   - Epistemic-aligned colors
 */

import React, { useMemo } from "react";
import type { ProvenanceGraph, ProvenanceNode, ProvenanceEdge } from "../../workflow/types";

// ─── Color Map ────────────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  STRUCTURE: "#005FB8",        // Cobalt
  TRAJECTORY: "#8250DF",       // Violet
  SELECTION: "#0969DA",        // Blue
  TRANSFORMED_TRAJECTORY: "#6E40C9",
  ANALYSIS: "#B45309",         // Amber
  COMPARISON: "#D1242F",       // Rose
  CERTIFICATE: "#0969DA",      // Emerald / Blue
  EXPORT: "#5C5C5C",           // Slate
  STEP: "#005FB8",             // Steps use Cobalt stroke
};

const STEP_FILL = "#FFFFFF";
const ARTIFACT_FILL = "#F8FAFC";

// ─── Layout ───────────────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  nodeType: "STEP" | "ARTIFACT";
  kind?: string;
}

function computeLayout(
  nodes: ProvenanceNode[],
  edges: ProvenanceEdge[]
): { lnodes: LayoutNode[]; width: number; height: number } {
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) { adj.set(n.node_id, []); inDeg.set(n.node_id, 0); }
  for (const e of edges) {
    adj.get(e.from_node)?.push(e.to_node);
    inDeg.set(e.to_node, (inDeg.get(e.to_node) ?? 0) + 1);
  }

  const levels = new Map<string, number>();
  const queue = nodes.filter(n => inDeg.get(n.node_id) === 0).map(n => n.node_id);
  queue.forEach(id => levels.set(id, 0));

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const curLevel = levels.get(curr) ?? 0;
    for (const nxt of adj.get(curr) ?? []) {
      const existing = levels.get(nxt) ?? 0;
      if (curLevel + 1 > existing) {
        levels.set(nxt, curLevel + 1);
        queue.push(nxt);
      }
    }
  }

  const byLevel = new Map<number, ProvenanceNode[]>();
  for (const n of nodes) {
    const lvl = levels.get(n.node_id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(n);
  }

  const X_STEP = 150;
  const Y_STEP = 54;
  const X_PAD = 24;
  const Y_PAD = 20;

  let maxLevel = 0;
  let maxPerLevel = 0;
  const lnodes: LayoutNode[] = [];

  for (const [lvl, lvlNodes] of byLevel.entries()) {
    if (lvl > maxLevel) maxLevel = lvl;
    if (lvlNodes.length > maxPerLevel) maxPerLevel = lvlNodes.length;

    lvlNodes.forEach((n, idx) => {
      const isStep = n.node_type === "STEP";
      const w = isStep ? 110 : 28;
      const h = isStep ? 30 : 28;
      const x = X_PAD + lvl * X_STEP;
      const y = Y_PAD + idx * Y_STEP;
      lnodes.push({
        id: n.node_id,
        x,
        y,
        width: w,
        height: h,
        label: n.label,
        nodeType: n.node_type,
        kind: (n as any).kind,
      });
    });
  }

  return {
    lnodes,
    width: Math.max(380, X_PAD * 2 + (maxLevel + 1) * X_STEP),
    height: Math.max(120, Y_PAD * 2 + maxPerLevel * Y_STEP),
  };
}

function edgePath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProvenanceGraphViewerProps {
  graph: ProvenanceGraph;
  className?: string;
}

export function ProvenanceGraphViewer({
  graph,
  className = "",
}: ProvenanceGraphViewerProps) {
  const { lnodes, width, height } = useMemo(
    () => computeLayout(graph.nodes, graph.edges),
    [graph]
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    lnodes.forEach(n => m.set(n.id, n));
    return m;
  }, [lnodes]);

  if (graph.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 text-xs text-[#5C5C5C] ${className}`}>
        No provenance data available.
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto overflow-y-auto rounded-[6px] border border-[#E5E5E5] bg-[#F8FAFC] scientific-scrollbar ${className}`}
      style={{ maxHeight: 400 }}
    >
      <svg
        width={width}
        height={Math.max(height, 120)}
        aria-label="Workflow provenance DAG"
        role="img"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
          </marker>
        </defs>

        {/* Edges */}
        {graph.edges.map((e, i) => {
          const from = nodeMap.get(e.from_node);
          const to = nodeMap.get(e.to_node);
          if (!from || !to) return null;
          return (
            <path
              key={i}
              d={edgePath(from, to)}
              fill="none"
              stroke="#94A3B8"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {/* Nodes */}
        {lnodes.map(n => {
          const color = KIND_COLOR[n.kind ?? "STEP"] ?? "#005FB8";
          if (n.nodeType === "STEP") {
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  rx={5}
                  fill={STEP_FILL}
                  stroke={color}
                  strokeWidth={1.5}
                  filter="drop-shadow(0 1px 1px rgba(0,0,0,0.05))"
                />
                <text
                  x={n.x + n.width / 2}
                  y={n.y + n.height / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1C1C1C"
                  fontSize={10}
                  fontFamily="Segoe UI Variable, system-ui, sans-serif"
                  fontWeight={600}
                >
                  {n.label}
                </text>
              </g>
            );
          }
          // Artifact: circle
          const cx = n.x + n.width / 2;
          const cy = n.y + n.height / 2;
          return (
            <g key={n.id}>
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill={ARTIFACT_FILL}
                stroke={color}
                strokeWidth={1.5}
              />
              <title>{n.label}</title>
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontSize={8}
                fontFamily="Segoe UI Variable, system-ui, sans-serif"
                fontWeight={700}
              >
                {(n.kind ?? "?").slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default ProvenanceGraphViewer;
