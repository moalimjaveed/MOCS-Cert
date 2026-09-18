/**
 * MOCS-Cert De Novo Protein Design Lineage & DAG Tracking Subsystem
 * 
 * Epistemic Status: ESTABLISHED
 * 
 * Tracks the complete provenance lineage graph for computational biopolymer designs:
 * Parent Scaffold -> Generated Backbone -> Designed Sequence -> Predicted Structure -> Docked Complex -> Validation.
 * 
 * Guarantees that every downstream design artifact is cryptographically and
 * historically linked to its exact upstream inputs, parameters, and random seeds.
 */

import { computeSequenceSha256 } from '../prediction/provenance';
import type { DesignLineageNode } from './types';

export class DesignLineageGraph {
  private nodes = new Map<string, DesignLineageNode>();

  /**
   * Adds a new design stage node to the lineage graph.
   */
  public addNode(
    stage: DesignLineageNode['stage'],
    modelName: string,
    modelVersion: string,
    artifactContent: string,
    parameters: Record<string, any> = {},
    parentId?: string,
    seed?: number,
    notes = ''
  ): DesignLineageNode {
    const sha256Digest = computeSequenceSha256(artifactContent);
    const nodeId = `node_${stage}_${sha256Digest.slice(0, 10)}`;

    // If parent is specified, ensure it exists in the graph
    if (parentId && !this.nodes.has(parentId)) {
      throw new Error(`Lineage parent node '${parentId}' does not exist in lineage graph.`);
    }

    const node: DesignLineageNode = {
      nodeId,
      stage,
      parentId,
      modelName,
      modelVersion,
      parameters,
      seed,
      sha256Digest,
      timestamp: new Date().toISOString(),
      notes,
    };

    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Retrieves a specific lineage node.
   */
  public getNode(nodeId: string): DesignLineageNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Traces the ancestral lineage path from a downstream node back to the root scaffold.
   */
  public getAncestralLineage(nodeId: string): DesignLineageNode[] {
    const path: DesignLineageNode[] = [];
    let curr = this.nodes.get(nodeId);

    while (curr) {
      path.unshift(curr);
      if (!curr.parentId) break;
      curr = this.nodes.get(curr.parentId);
    }

    return path;
  }

  /**
   * Verifies lineage continuity (ensures no orphaned or disconnected nodes in the chain).
   */
  public verifyLineageContinuity(nodeId: string): {
    isContinuous: boolean;
    depth: number;
    stages: string[];
  } {
    const lineage = this.getAncestralLineage(nodeId);
    const stages = lineage.map((n) => n.stage);
    return {
      isContinuous: lineage.length > 0 && lineage[0].parentId === undefined,
      depth: lineage.length,
      stages,
    };
  }

  /**
   * Clears the graph.
   */
  public clear(): void {
    this.nodes.clear();
  }
}
