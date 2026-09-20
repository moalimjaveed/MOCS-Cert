// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  calculateMinimumImageDistance,
  UnsupportedBoxGeometryError,
  validateOrthorhombicBox,
} from '../molecular/measurements/calculations';
import {
  auditDockingPose,
} from '../molecular/design/dockingAudit';
import {
  classifyPairInteraction,
} from '../molecular/interactions/interactionClassifier';
import {
  calculateRawCoordinateRmsd,
} from '../molecular/protein/alignment';
import {
  classifyPlddt,
  extractPlddtFromPdb,
  validatePaeMatrix,
  calculateConfidenceSummary,
} from '../molecular/prediction/confidenceParser';
import {
  computeMolecularVdwVolume,
} from '../molecular/surfaces/volumeEngine';
import {
  detectGeometricPockets,
} from '../molecular/surfaces/pocketEngine';
import {
  createModelProvenance,
  assertScientificallyDefensibleTerminology,
} from '../molecular/prediction/provenance';
import {
  createScientificResult,
  exportScientificResultToJson,
  exportScientificResultToCsv,
} from '../molecular/integration/scientificResultModel';
import {
  resolveDesignCandidate,
} from '../molecular/resolver/resolveDesignCandidate';
import {
  resolveProteinSequenceFold,
} from '../molecular/resolver/resolveSequenceFold';

describe('PASS 22 — Scientific Boundary, Claim & Semantic Integrity Regression Suite', () => {

  // =========================================================================
  // 1 & 2. Docking Score vs Thermodynamic Free Energy & Dissociation Constants
  // =========================================================================
  describe('1 & 2. Docking Scoring Semantics & Affinity Rejection', () => {
    const mockReceptor = [
      { element: 'C', coords: [0, 0, 0] as [number, number, number], chainId: 'A', resSeq: 1 },
      { element: 'N', coords: [1.5, 0, 0] as [number, number, number], chainId: 'A', resSeq: 1 },
    ];
    const mockLigand = [
      { element: 'C', coords: [4.0, 0, 0] as [number, number, number], atomName: 'C1' },
      { element: 'O', coords: [5.2, 0, 0] as [number, number, number], atomName: 'O1' },
    ];

    it('1. docking score defaults to empirical pose score, NOT affinity or free energy', () => {
      const pose = auditDockingPose({
        receptorId: '4HHB',
        ligandId: 'HEM',
        dockingEngine: 'AutoDock Vina',
        engineVersion: '1.2.5',
        poseRank: 1,
        rawScore: -8.4,
        receptorAtoms: mockReceptor,
        ligandAtoms: mockLigand,
      });

      expect(pose.isExperimentalAffinity).toBe(false);
      expect(pose.scoreMetric).toBe('Empirical Docking Pose Score');
      expect(pose.scoreMetric).not.toContain('Affinity');
      expect(pose.scientificCaveats.some(c => c.includes('does not constitute a measured thermodynamic free energy (ΔG°)'))).toBe(true);
    });

    it('2. prohibited claims guard rejects claiming docking score is binding free energy or Kd/Ki', () => {
      const badClaim = 'The docking free energy was ΔG = -8.4 kcal/mol with predicted Kd of 1.2 nM.';
      const audit = assertScientificallyDefensibleTerminology(badClaim);
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('binding free energy'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Heavy-Atom Hydrogen Bond Proxy Qualification
  // =========================================================================
  describe('3. Hydrogen-Bond Semantic Boundaries', () => {
    it('strictly types heavy-atom donor-acceptor proximity as PUTATIVE without explicit hydrogens', () => {
      const donor = {
        atomName: 'NE2',
        element: 'N',
        residueName: 'HIS',
        residueNumber: 87,
        chainId: 'A',
        coordinates: [16.894, 20.030, 24.002] as [number, number, number],
        isHetero: false,
      };
      const acceptor = {
        atomName: 'O',
        element: 'O',
        residueName: 'GLY',
        residueNumber: 25,
        chainId: 'A',
        coordinates: [18.0, 20.0, 24.0] as [number, number, number],
        isHetero: false,
      };

      // Distance is ~1.1 Å (donor-acceptor proximity)
      const contact = classifyPairInteraction(donor, acceptor, 2.8, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).toBe('HYDROGEN_BOND_PUTATIVE');
      expect(contact.epistemicLevel).toBe('INFERRED_INTERACTION');
      expect(contact.epistemicLevel).not.toBe('OBSERVED_STRUCTURAL_CONTACT');
    });

    it('promotes to HYDROGEN_BOND_EXPLICIT only when explicit hydrogen coordinates satisfy angle >= 120°', () => {
      const donor = {
        atomName: 'N',
        element: 'N',
        residueName: 'ALA',
        residueNumber: 10,
        chainId: 'A',
        coordinates: [0, 0, 0] as [number, number, number],
        isHetero: false,
      };
      const acceptor = {
        atomName: 'O',
        element: 'O',
        residueName: 'VAL',
        residueNumber: 15,
        chainId: 'A',
        coordinates: [2.8, 0, 0] as [number, number, number],
        isHetero: false,
      };
      const explicitH: [number, number, number] = [1.0, 0, 0]; // Collinear: D - H ... A angle is 180°

      const contact = classifyPairInteraction(donor, acceptor, 2.8, 'EXPERIMENTAL_DEPOSITED', explicitH);
      expect(contact.type).toBe('HYDROGEN_BOND_EXPLICIT');
      expect(contact.epistemicLevel).toBe('OBSERVED_STRUCTURAL_CONTACT');
      expect(contact.geometryDetails?.donorAcceptorAngleDeg).toBe(180);
    });
  });

  // =========================================================================
  // 4. Periodic Boundary Conditions: Triclinic Rejection
  // =========================================================================
  describe('4. PBC Semantic Boundary & Triclinic Rejection', () => {
    it('accepts valid 1D orthorhombic simulation box vector', () => {
      const box = validateOrthorhombicBox([80.0, 80.0, 80.0]);
      expect(box).toEqual([80.0, 80.0, 80.0]);
    });

    it('accepts valid 3x3 diagonal box matrix', () => {
      const boxMatrix = [
        [60.0, 0.0, 0.0],
        [0.0, 70.0, 0.0],
        [0.0, 0.0, 80.0],
      ];
      const box = validateOrthorhombicBox(boxMatrix);
      expect(box).toEqual([60.0, 70.0, 80.0]);
    });

    it('strictly throws UnsupportedBoxGeometryError for triclinic 3x3 matrix with off-diagonal shear', () => {
      const triclinicMatrix = [
        [80.0, 15.0, 0.0],
        [0.0, 80.0, 0.0],
        [0.0, 0.0, 80.0],
      ];
      expect(() => validateOrthorhombicBox(triclinicMatrix)).toThrow(UnsupportedBoxGeometryError);
      expect(() => calculateMinimumImageDistance([0, 0, 0], [10, 10, 10], triclinicMatrix)).toThrow(
        UnsupportedBoxGeometryError
      );
    });

    it('strictly throws UnsupportedBoxGeometryError for unit cell angles != 90°', () => {
      const monoclinicBox = {
        dimensions: [80.0, 80.0, 80.0],
        alpha: 90.0,
        beta: 105.0,
        gamma: 90.0,
      };
      expect(() => validateOrthorhombicBox(monoclinicBox)).toThrow(/Non-orthogonal unit cell angles/);
    });

    it('rejects negative or degenerate box extents', () => {
      expect(() => validateOrthorhombicBox([80.0, -10.0, 80.0])).toThrow(/strictly positive/);
      expect(() => validateOrthorhombicBox([80.0, 0.0, 80.0])).toThrow(/strictly positive/);
      expect(() => validateOrthorhombicBox([80.0, NaN, 80.0])).toThrow(/non-finite/);
    });
  });

  // =========================================================================
  // 5 & 6. pLDDT & PAE Confidence Semantics
  // =========================================================================
  describe('5 & 6. Confidence Semantics (pLDDT & PAE)', () => {
    it('5. pLDDT is local distance difference test (0-100), not probability of correctness', () => {
      expect(classifyPlddt(95)).toBe('very_high');
      expect(classifyPlddt(75)).toBe('confident');
      expect(classifyPlddt(55)).toBe('low');
      expect(classifyPlddt(30)).toBe('very_low');

      const audit = assertScientificallyDefensibleTerminology('This structure has 95% probability of correctness.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('probability of correctness'))).toBe(true);
    });

    it('6. PAE is Predicted Aligned Error in Angstroms, not coordinate RMSD', () => {
      const matrix = [
        [0.0, 2.5],
        [4.2, 0.0], // Asymmetric: PAE(0, 1) != PAE(1, 0)
      ];
      const pae = validatePaeMatrix(matrix, 2);
      expect(pae.isAsymmetric).toBe(true);
      expect(pae.meanError).toBe(1.68);

      const audit = assertScientificallyDefensibleTerminology('The predicted aligned error rmsd was 2.5 A.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('PAE as coordinate RMSD'))).toBe(true);
    });
  });

  // =========================================================================
  // 7. AABB Volume vs Molecular Volume
  // =========================================================================
  describe('7. Molecular Volume vs Bounding Box Volume', () => {
    it('strictly separates AABB container volume from integrated van der Waals volume', () => {
      const atoms = [
        { element: 'C', coordinates: [0, 0, 0] as [number, number, number] },
        { element: 'C', coordinates: [10, 10, 10] as [number, number, number] },
      ];
      const res = computeMolecularVdwVolume(atoms, { gridSpacing: 0.8 });

      expect(res.boundingVolumeAABB).toBeGreaterThan(0);
      expect(res.vdwVolume).toBeGreaterThan(0);
      // V_vdw of two carbon spheres (~2 * 20 Å³ = 40 Å³) is far smaller than AABB (10x10x10 = 1000 Å³)
      expect(res.vdwVolume).toBeLessThan(res.boundingVolumeAABB);
      expect(res.packingFraction).toBeLessThan(0.2);

      const audit = assertScientificallyDefensibleTerminology('The molecular volume: 1000 Å³ (aabb) was computed.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('AABB as molecular volume'))).toBe(true);
    });
  });

  // =========================================================================
  // 8. Geometric Cavity vs Biological Active Site
  // =========================================================================
  describe('8. Geometric Cavity vs Biological Active Site', () => {
    it('classifies 3D voids strictly as Predicted Geometric Cavity, NEVER active site', () => {
      // Hollow sphere of atoms enclosing empty cavity
      const atoms = [];
      const R = 8.0;
      for (let theta = 0; theta < Math.PI; theta += 0.5) {
        for (let phi = 0; phi < 2 * Math.PI; phi += 0.5) {
          atoms.push({
            element: 'C',
            coordinates: [
              Number((R * Math.sin(theta) * Math.cos(phi)).toFixed(3)),
              Number((R * Math.sin(theta) * Math.sin(phi)).toFixed(3)),
              Number((R * Math.cos(theta)).toFixed(3)),
            ] as [number, number, number],
          });
        }
      }

      const res = detectGeometricPockets(atoms, { minPocketVolume: 10.0 });
      expect(res.provenance).toBe('COMPUTATIONAL_PREDICTION');
      if (res.pockets.length > 0) {
        expect(res.pockets[0].pocketId).toContain('CAV_');
      }

      const audit = assertScientificallyDefensibleTerminology('This geometric cavity is active site for catalytic binding.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('geometric cavity as active site'))).toBe(true);
    });
  });

  // =========================================================================
  // 9. Contact vs Chemically Validated Interaction
  // =========================================================================
  describe('9. Proximity Contact vs Validated Interaction', () => {
    it('labels distance cutoff alone as GEOMETRIC_PROXIMITY without biochemical confirmation', () => {
      const atomA = {
        atomName: 'C',
        element: 'C',
        residueName: 'ALA',
        residueNumber: 1,
        chainId: 'A',
        coordinates: [0, 0, 0] as [number, number, number],
        isHetero: false,
      };
      const atomB = {
        atomName: 'N',
        element: 'N',
        residueName: 'GLY',
        residueNumber: 2,
        chainId: 'B',
        coordinates: [5.0, 0, 0] as [number, number, number],
        isHetero: false,
      };

      const contact = classifyPairInteraction(atomA, atomB, 5.0, 'EXPERIMENTAL_DEPOSITED');
      expect(contact.type).toBe('GEOMETRIC_PROXIMITY');
      expect(contact.epistemicLevel).toBe('GEOMETRIC_PROXIMITY');
      expect(contact.epistemicLevel).not.toBe('OBSERVED_STRUCTURAL_CONTACT');
    });
  });

  // =========================================================================
  // 10. RMSD vs Stability
  // =========================================================================
  describe('10. RMSD / RMSF vs Folding Stability', () => {
    it('computes coordinate root-mean-square deviation without claiming thermodynamic stability', () => {
      const coordsA: Array<[number, number, number]> = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ];
      const coordsB: Array<[number, number, number]> = [
        [0.1, 0, 0],
        [1.1, 0, 0],
        [0, 1.1, 0],
      ];

      const rmsd = calculateRawCoordinateRmsd(coordsA, coordsB);
      expect(rmsd).toBeCloseTo(0.1, 4);

      const audit = assertScientificallyDefensibleTerminology('Low rmsd proves stability of this protein fold.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('RMSD as folding stability'))).toBe(true);
    });
  });

  // =========================================================================
  // 11. Synthetic Benchmark Remains Synthetic
  // =========================================================================
  describe('11. Synthetic Benchmark Provenance', () => {
    it('creates synthetic calibration provenance with isExperimental = false', () => {
      const prov = createModelProvenance({
        provider: 'synthetic_calibration',
        modelName: 'MOCS_Synthetic_500f',
        epistemicOrigin: 'synthetic_calibration',
        sequence: 'MKVLWAGPSY',
      });

      expect(prov.isExperimental).toBe(false);
      expect(prov.epistemicOrigin).toBe('synthetic_calibration');
      expect(prov.scientificCaveats.some(c => c.includes('mathematically synthesized'))).toBe(true);
    });
  });

  // =========================================================================
  // 12 & 13. Predicted & Generated Structures Retain Non-Experimental Provenance
  // =========================================================================
  describe('12 & 13. Predicted & Generated Origin Integrity', () => {
    it('12. resolveDesignCandidate preserves designed origin and sets plddt, NOT experimental resolution', () => {
      const res = resolveDesignCandidate('RFD-BINDER-01');
      expect(res.candidate.experimental).toBe(false);
      expect(res.candidate.resolution).toBeUndefined();
      expect(res.candidate.plddt).toBe(93.8);
      expect(res.provenance.experimental).toBe(false);
      expect(res.metadata.category).toBe('designed_candidate');
    });

    it('13. offline sequence fold fallback is explicitly qualified as synthetic, not ESMFold inference', async () => {
      const ctrl = new AbortController();
      ctrl.abort(); // Offline
      const res = await resolveProteinSequenceFold('MKVLWAGPSY', 'test_model', ctrl.signal);

      expect(res.candidate.experimental).toBe(false);
      expect(res.candidate.source).toBe('computed');
      expect(res.candidate.provider).toContain('Synthetic Backbone Generator');
      expect(res.pdbText).toContain('REMARK 250 NOT AN AUTHENTIC ESMFOLD NEURAL NETWORK INFERENCE');
    });
  });

  // =========================================================================
  // 14. External Model Invocation vs Local Inference
  // =========================================================================
  describe('14. Prediction Execution Qualification', () => {
    it('rejects claiming local neural-network inference when models are externally fetched', () => {
      const audit = assertScientificallyDefensibleTerminology('We completed running alphafold locally on GPU.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('external prediction as local inference'))).toBe(true);
    });
  });

  // =========================================================================
  // 15. Certificate Semantics: Software Invariants vs Wet-Lab Truth
  // =========================================================================
  describe('15. Certificate Epistemic Semantics', () => {
    it('certificates certify execution invariants, rejecting conflation with biological truth', () => {
      const audit = assertScientificallyDefensibleTerminology('This certificate guarantees ground truth structure in vivo.');
      expect(audit.isClean).toBe(false);
      expect(audit.violations.some(v => v.includes('ground truth structure'))).toBe(true);
    });
  });

  // =========================================================================
  // 16. Unsupported Calculations Cannot Silently Return Valid-Looking Zero
  // =========================================================================
  describe('16. Fail-Closed Error Semantics', () => {
    it('throws UnsupportedBoxGeometryError instead of returning 0 for non-orthorhombic box', () => {
      const badBox = [
        [10.0, 5.0, 0.0],
        [0.0, 10.0, 0.0],
        [0.0, 0.0, 10.0],
      ];
      expect(() => calculateMinimumImageDistance([0, 0, 0], [1, 1, 1], badBox)).toThrow(
        UnsupportedBoxGeometryError
      );
    });
  });

  // =========================================================================
  // 17 & 18. Export Context & Lineage Integrity (JSON & CSV)
  // =========================================================================
  describe('17 & 18. Export Lineage & Context Preservation', () => {
    const result = createScientificResult({
      resultType: 'CAVITY_VOLUME_PREDICTION',
      source: {
        structureId: '4HHB',
        modelId: 1,
        chainId: 'A',
      },
      selection: 'A:142',
      parameters: {
        algorithm: '3d_grid_flood_fill',
        scoringFunction: 'cavity_voxel_v1',
        isApproximation: true,
      },
      unit: 'Å³',
      status: 'COMPUTED',
      provenance: {
        epistemicOrigin: 'computational_prediction',
        provider: 'MOCS Pocket Engine',
        isExperimental: false,
      },
      value: 142.5,
      uncertainty: 5.0,
      warnings: ['Geometric cavity proxy; does not imply catalytic active site.'],
    });

    it('17. JSON export retains value, unit, algorithm, method, source, and approximation status', () => {
      const jsonStr = exportScientificResultToJson(result);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.resultType).toBe('CAVITY_VOLUME_PREDICTION');
      expect(parsed.value).toBe(142.5);
      expect(parsed.unit).toBe('Å³');
      expect(parsed.algorithm).toBe('3d_grid_flood_fill');
      expect(parsed.source.structureId).toBe('4HHB');
      expect(parsed.source.chainId).toBe('A');
      expect(parsed.provenance.isExperimental).toBe(false);
      expect(parsed.approximationStatus.isApproximation).toBe(true);
      expect(parsed.sha256Digest).toContain('sha256-mocs-');
    });

    it('18. CSV export retains all mandatory scientific lineage columns without ambiguity', () => {
      const csvStr = exportScientificResultToCsv([result]);
      const lines = csvStr.trim().split('\n');
      expect(lines.length).toBe(2);

      const header = lines[0];
      expect(header).toContain('resultType');
      expect(header).toContain('value');
      expect(header).toContain('unit');
      expect(header).toContain('algorithm');
      expect(header).toContain('structureId');
      expect(header).toContain('isApproximation');

      const dataRow = lines[1];
      expect(dataRow).toContain('CAVITY_VOLUME_PREDICTION');
      expect(dataRow).toContain('142.5');
      expect(dataRow).toContain('Å³');
      expect(dataRow).toContain('4HHB');
      expect(dataRow).toContain('true');
    });
  });
});
