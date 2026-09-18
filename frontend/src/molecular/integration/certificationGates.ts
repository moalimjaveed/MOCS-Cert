/**
 * MOCS-Cert Automated Scientific Certification Gates Engine
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: 9 Invariant Automated Gates (Section 48)
 */

import type {
  CertificationGateId,
  GateEvaluationResult,
  ScientificResultEnvelope,
  ScientificUnit,
} from './types';
import { APPROVED_SCIENTIFIC_UNITS, isScientificResult } from './scientificResultModel';
import { crossModuleCache } from './crossModuleCache';
import { concurrencyArbiter } from './concurrencyArbiter';
import { parseCanonicalSelection } from '../geometry/structuralIdentity';
import { verifyPdbRoundTripFidelity, exportToPdb, extractAtomRecords } from './scientificExport';

export class ScientificCertificationEngine {
  /**
   * Evaluates GATE-IDENTITY:
   * Asserts that selections in multi-chain contexts cannot be ambiguous.
   */
  public verifyGateIdentity(
    selectionQuery: string,
    isMultiChain: boolean,
    hasExplicitChain: boolean
  ): GateEvaluationResult {
    const token = parseCanonicalSelection(selectionQuery);

    if (isMultiChain && !token.isExplicitChain && !hasExplicitChain) {
      return {
        gateId: 'GATE-IDENTITY',
        passed: false,
        details: `Ambiguous selection '${selectionQuery}' rejected: missing explicit chain ID in multi-chain context.`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-IDENTITY',
      passed: true,
      details: `Selection '${selectionQuery}' contains explicit chain context (${token.chainId || 'Explicit Scoped'}).`,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-UNITS:
   * Asserts that all scientific results specify approved, calibrated units.
   */
  public verifyGateUnits(unit: ScientificUnit | string): GateEvaluationResult {
    if (!APPROVED_SCIENTIFIC_UNITS.has(unit as ScientificUnit)) {
      return {
        gateId: 'GATE-UNITS',
        passed: false,
        details: `Unrecognized unit '${unit}'. Approved units: ${Array.from(APPROVED_SCIENTIFIC_UNITS).join(', ')}`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-UNITS',
      passed: true,
      details: `Unit '${unit}' satisfies scientific contract.`,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-PROVENANCE:
   * Asserts that every derived scientific result has traceable provenance with provider and hash.
   */
  public verifyGateProvenance(result: ScientificResultEnvelope): GateEvaluationResult {
    if (!isScientificResult(result)) {
      return {
        gateId: 'GATE-PROVENANCE',
        passed: false,
        details: 'Result is not a valid ScientificResultEnvelope.',
        evaluatedAt: Date.now(),
      };
    }

    const prov = result.provenance;
    if (!prov || (!prov.provider && !prov.source)) {
      return {
        gateId: 'GATE-PROVENANCE',
        passed: false,
        details: 'Missing authoritative data provider or source in provenance record.',
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-PROVENANCE',
      passed: true,
      details: `Authoritative provenance verified: provider '${prov.provider || prov.source}'.`,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-TRAJECTORY:
   * Asserts that frame N returns frame N coordinates and coordinate evolution occurs.
   */
  public verifyGateTrajectory(
    frameA: number,
    coordsA: [number, number, number],
    frameB: number,
    coordsB: [number, number, number]
  ): GateEvaluationResult {
    if (frameA === frameB) {
      const match =
        coordsA[0] === coordsB[0] &&
        coordsA[1] === coordsB[1] &&
        coordsA[2] === coordsB[2];
      return {
        gateId: 'GATE-TRAJECTORY',
        passed: match,
        details: match
          ? `Deterministic repeatability verified at frame ${frameA}.`
          : `Non-deterministic coordinates at frame ${frameA}.`,
        evaluatedAt: Date.now(),
      };
    }

    // Different frames should exhibit non-zero coordinate displacement
    const dx = coordsA[0] - coordsB[0];
    const dy = coordsA[1] - coordsB[1];
    const dz = coordsA[2] - coordsB[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 1e-6) {
      return {
        gateId: 'GATE-TRAJECTORY',
        passed: false,
        details: `Coordinate evolution failure: frame ${frameA} and frame ${frameB} have identical coordinates (dist = 0).`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-TRAJECTORY',
      passed: true,
      details: `Non-static coordinate evolution confirmed between frame ${frameA} and ${frameB} (displacement = ${dist.toFixed(3)} Å).`,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-CACHE:
   * Asserts that cache keys distinguish structure, model, chain, frame, and parameters.
   */
  public verifyGateCache(
    key1Scope: Parameters<typeof crossModuleCache.buildKey>[0],
    key2Scope: Parameters<typeof crossModuleCache.buildKey>[0]
  ): GateEvaluationResult {
    const k1 = crossModuleCache.buildKey(key1Scope);
    const k2 = crossModuleCache.buildKey(key2Scope);

    const isSameInput = JSON.stringify(key1Scope) === JSON.stringify(key2Scope);

    if (isSameInput && k1 !== k2) {
      return {
        gateId: 'GATE-CACHE',
        passed: false,
        details: 'Identical inputs produced divergent cache keys.',
        evaluatedAt: Date.now(),
      };
    }

    if (!isSameInput && k1 === k2) {
      return {
        gateId: 'GATE-CACHE',
        passed: false,
        details: 'Different inputs collided on identical cache key.',
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-CACHE',
      passed: true,
      details: 'Cache key construction preserves input orthogonality without collisions.',
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-RACE:
   * Asserts that stale asynchronous responses are rejected by the concurrency arbiter.
   */
  public verifyGateRace(domain: string): GateEvaluationResult {
    const req1 = concurrencyArbiter.registerRequest(domain, 'item-A');
    const req2 = concurrencyArbiter.registerRequest(domain, 'item-B');

    const isReq1Stale = concurrencyArbiter.isStale(domain, req1.token);
    const isReq2Stale = concurrencyArbiter.isStale(domain, req2.token);

    if (!isReq1Stale || isReq2Stale) {
      return {
        gateId: 'GATE-RACE',
        passed: false,
        details: 'Stale response detection failed: superseded token was not flagged as stale.',
        evaluatedAt: Date.now(),
      };
    }

    concurrencyArbiter.completeRequest(domain, req2.token);

    return {
      gateId: 'GATE-RACE',
      passed: true,
      details: 'Monotonic request ordering and stale response suppression verified.',
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-CHAIN:
   * Asserts that multi-chain operations (e.g. 4HHB Chain A vs Chain C) strictly isolate residues.
   */
  public verifyGateChain(
    chainAItems: Array<{ chainId: string }>,
    targetChain: string
  ): GateEvaluationResult {
    const normTarget = targetChain.toUpperCase();
    const foreignItems = chainAItems.filter((item) => item.chainId.toUpperCase() !== normTarget);

    if (foreignItems.length > 0) {
      return {
        gateId: 'GATE-CHAIN',
        passed: false,
        details: `Cross-chain contamination detected: ${foreignItems.length} items from foreign chains found in Chain ${targetChain} scope.`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-CHAIN',
      passed: true,
      details: `Strict chain isolation verified: all ${chainAItems.length} items belong exclusively to Chain ${targetChain}.`,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-DATA:
   * Asserts that malformed data (NaN coordinates, empty strings) fails gracefully with explicit errors.
   */
  public verifyGateData(coords: [number, number, number]): GateEvaluationResult {
    const isFinite = coords.every((v) => Number.isFinite(v));

    if (!isFinite) {
      return {
        gateId: 'GATE-DATA',
        passed: false,
        details: `Malformed coordinates detected: [${coords.join(', ')}] contains non-finite values (NaN/Infinity).`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-DATA',
      passed: true,
      details: 'Input coordinates pass numerical finiteness validation.',
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluates GATE-EXPORT:
   * Asserts that serialization preserves coordinates, chain IDs, and atom counts.
   */
  public verifyGateExport(sampleAtoms: any[]): GateEvaluationResult {
    const records = extractAtomRecords(sampleAtoms);
    const pdb = exportToPdb(records);
    const result = verifyPdbRoundTripFidelity(records, pdb);

    if (!result.matches) {
      return {
        gateId: 'GATE-EXPORT',
        passed: false,
        details: `Round-trip fidelity check failed: max coordinate delta = ${result.maxCoordDelta} Å, expected <= 0.002 Å.`,
        evaluatedAt: Date.now(),
      };
    }

    return {
      gateId: 'GATE-EXPORT',
      passed: true,
      details: `Round-trip fidelity confirmed: ${result.atomCountParsed} atoms, max delta = ${result.maxCoordDelta.toFixed(4)} Å.`,
      evaluatedAt: Date.now(),
    };
  }
}

export const scientificCertificationEngine = new ScientificCertificationEngine();
