/**
 * Scientific and Conformance Error Hierarchy for MOCS Molecular Render Lab.
 * Enforces fail-closed behavior across identity, selection, geometry, and rendering.
 */

export class ScientificError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScientificError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ScientificAmbiguityError extends ScientificError {
  constructor(
    public readonly query: string,
    public readonly matchCount: number,
    public readonly candidates: unknown[],
    message?: string
  ) {
    super(
      message ??
        `Scientific Ambiguity: Query '${query}' resolved to ${matchCount} matches. Fail-closed requires exact disambiguation.`
    );
    this.name = 'ScientificAmbiguityError';
  }
}

export class InvalidOperatorMatrixError extends ScientificError {
  constructor(public readonly operatorId: string, public readonly details: string) {
    super(`Invalid Operator Matrix for '${operatorId}': ${details}. Missing or non-finite matrices fail closed.`);
    this.name = 'InvalidOperatorMatrixError';
  }
}

export class RendererConformanceError extends Error {
  constructor(
    public readonly expected: Record<string, unknown>,
    public readonly actual: Record<string, unknown>,
    message?: string
  ) {
    super(
      message ??
        `Renderer Conformance Failure: Rendered state does not match desired scientific state.\nExpected: ${JSON.stringify(
          expected
        )}\nActual: ${JSON.stringify(actual)}`
    );
    this.name = 'RendererConformanceError';
  }
}

export class TrajectoryMismatchError extends ScientificError {
  constructor(
    public readonly topologyAtomCount: number,
    public readonly trajectoryAtomCount: number,
    message?: string
  ) {
    super(
      message ??
        `Trajectory Mismatch: Topology atom count (${topologyAtomCount}) != Trajectory atom count (${trajectoryAtomCount}). Fail closed.`
    );
    this.name = 'TrajectoryMismatchError';
  }
}

export class AtomNotFoundError extends ScientificError {
  constructor(
    public readonly query: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Atom '${query}' not found in dataset '${datasetId}'.`);
    this.name = 'AtomNotFoundError';
  }
}

export class ResidueNotFoundError extends ScientificError {
  constructor(
    public readonly query: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Residue '${query}' not found in dataset '${datasetId}'.`);
    this.name = 'ResidueNotFoundError';
  }
}

export class FocusTargetNotFoundError extends ScientificError {
  constructor(
    public readonly query: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Focus target '${query}' not found in dataset '${datasetId}'.`);
    this.name = 'FocusTargetNotFoundError';
  }
}

export class CapabilityUnavailableError extends ScientificError {
  constructor(
    public readonly capability: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Capability '${capability}' is unavailable in dataset '${datasetId}'.`);
    this.name = 'CapabilityUnavailableError';
  }
}

export class StateRefStaleError extends ScientificError {
  constructor(
    public readonly ref: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `State reference '${ref}' is stale or missing from dataset '${datasetId}' session.`);
    this.name = 'StateRefStaleError';
  }
}

export class RepresentationNotFoundError extends ScientificError {
  constructor(
    public readonly kind: string,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Representation '${kind}' not found in dataset '${datasetId}'.`);
    this.name = 'RepresentationNotFoundError';
  }
}

export class BlockNotFoundError extends ScientificError {
  constructor(
    public readonly blockId: string | number,
    public readonly datasetId: string,
    message?: string
  ) {
    super(message ?? `Temporal block '${blockId}' does not exist in dataset '${datasetId}'.`);
    this.name = 'BlockNotFoundError';
  }
}
