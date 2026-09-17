import { PluginContext } from 'molstar/lib/mol-plugin/context.js';
import { StateSelection } from 'molstar/lib/mol-state/index.js';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms.js';
import { RendererConformanceError } from '@mocs/core';
import { assertConformance, DesiredProofCounts } from '@mocs/conformance';

export const PROOF_TAGS = {
  ALL_PROOF: 'mocs-proof',
  AABB: 'mocs-aabb',
  CALIPER: 'mocs-caliper',
  RETICLE: 'mocs-reticle',
  REPRESENTATION: 'mocs-repr',
} as const;

export type ProofCounts = DesiredProofCounts;

export class MolstarStateManager {
  constructor(private readonly plugin: PluginContext) {}

  /**
   * Queries actual counts of active proof nodes currently committed in the Mol* state tree.
   */
  getActualProofCounts(): {
    aabbCount: number;
    caliperCount: number;
    reticleCount: number;
    totalProofNodes: number;
    totalRepresentations: number;
  } {
    const data = this.plugin.state.data;
    const aabbNodes = data.select(StateSelection.Generators.root.subtree().withTag(PROOF_TAGS.AABB));
    const caliperNodes = data.select(StateSelection.Generators.root.subtree().withTag(PROOF_TAGS.CALIPER));
    const reticleNodes = data.select(StateSelection.Generators.root.subtree().withTag(PROOF_TAGS.RETICLE));
    const allProofNodes = data.select(StateSelection.Generators.root.subtree().withTag(PROOF_TAGS.ALL_PROOF));

    const reprNodes = data.select(
      StateSelection.Generators.root
        .subtree()
        .filter(
          (c) =>
            c.transform.transformer === StateTransforms.Representation.StructureRepresentation3D ||
            c.transform.transformer === StateTransforms.Representation.ShapeRepresentation3D
        )
    );

    return {
      aabbCount: aabbNodes.length,
      caliperCount: caliperNodes.length,
      reticleCount: reticleNodes.length,
      totalProofNodes: allProofNodes.length,
      totalRepresentations: reprNodes.length,
    };
  }

  /**
   * Removes all state-tree nodes matching a tag, waits for the transaction, and verifies count === 0.
   */
  async purgeNodesByTag(tag: string): Promise<void> {
    const data = this.plugin.state.data;
    const targets = data.select(StateSelection.Generators.root.subtree().withTag(tag));

    if (targets.length === 0) return;

    const update = this.plugin.build();
    for (const cell of targets) {
      update.delete(cell.transform.ref);
    }
    await update.commit();

    // Verify hard invariant: actual count MUST be 0
    const remaining = data.select(StateSelection.Generators.root.subtree().withTag(tag));
    if (remaining.length > 0) {
      throw new RendererConformanceError(
        { [tag]: 0 },
        { [tag]: remaining.length },
        `Failed to purge state-tree nodes with tag '${tag}'. Residual nodes remain.`
      );
    }
  }

  /**
   * Purges all proof geometry from the state tree.
   */
  async purgeAllProofGeometry(): Promise<void> {
    await this.purgeNodesByTag(PROOF_TAGS.ALL_PROOF);
  }

  /**
   * Asserts conformance between desired counts and actual Mol* state-tree counts.
   */
  assertProofConformance(desired: DesiredProofCounts): void {
    const actual = this.getActualProofCounts();
    assertConformance(desired, actual);
  }

  /**
   * Idempotent Resync Engine:
   * Detects divergence between desired proof counts and actual Mol* state tree.
   * Purges orphaned/stale nodes, re-applies desired geometry, and verifies postconditions.
   */
  async reconcileProofState(
    desired: ProofCounts,
    rebuilder?: () => Promise<void>
  ): Promise<{ reconciled: boolean; actual: ProofCounts }> {
    let actual = this.getActualProofCounts();
    const isConformant =
      actual.aabbCount === desired.aabbCount &&
      actual.caliperCount === desired.caliperCount &&
      actual.reticleCount === desired.reticleCount;

    if (isConformant) {
      return { reconciled: false, actual };
    }

    // Divergence detected: Purge stale tagged proof nodes to restore clean state
    await this.purgeAllProofGeometry();

    // Reconstruct desired items if rebuilder is provided
    if (rebuilder) {
      await rebuilder();
    }

    // Re-verify invariant postconditions
    actual = this.getActualProofCounts();
    this.assertProofConformance(desired);

    return { reconciled: true, actual };
  }
}
