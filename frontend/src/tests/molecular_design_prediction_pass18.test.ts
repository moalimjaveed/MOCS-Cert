// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  // Provenance & Epistemic Origin
  distinguishModelOrigin,
  createModelProvenance,
  assertScientificallyDefensibleTerminology,
  STRUCTURE_REGISTRY,
  type StructureMetadata,

  // ProteinMPNN Sequence Design
  runProteinMpnnDesign,
  validateBackboneGeometry,

  // RFdiffusion Backbone Generation
  parseRfdiffusionContigSpec,
  validateHotspotConstraints,
  runRfdiffusionBackboneGeneration,

  // Docking Audit
  auditDockingPose,
  BiopolymerMismatchError,

  // Structural Plausibility
  validateStructuralPlausibility,

  // Lineage Graph
  DesignLineageGraph,
} from '../molecular';

describe('PASS 18 — Protein Design, Structure Generation, Prediction & Docking Forensic Suite', () => {
  // Synthesize a 15-residue realistic alpha-helical C-alpha backbone
  const buildHelicalBackbone = (length = 15): Array<[number, number, number]> => {
    const coords: Array<[number, number, number]> = [];
    const radius = 2.3;
    const pitch = 1.5;
    const angleStep = (100 * Math.PI) / 180;
    for (let i = 0; i < length; i++) {
      const angle = i * angleStep;
      coords.push([
        Number((Math.cos(angle) * radius).toFixed(3)),
        Number((Math.sin(angle) * radius).toFixed(3)),
        Number((i * pitch).toFixed(3)),
      ]);
    }
    return coords;
  };

  describe('1. Model Provenance & Epistemic Origin Classification', () => {
    it('accurately categorizes experimental vs predicted vs designed vs synthetic structures', () => {
      // Experimental
      expect(distinguishModelOrigin({ category: 'existing_experimental', provider: 'RCSB PDB' })).toBe('experimental');
      // Predicted
      expect(distinguishModelOrigin({ category: 'computed_predicted', provider: 'AlphaFold DB' })).toBe('predicted');
      // Designed
      expect(distinguishModelOrigin({ category: 'designed_candidate', provider: 'RFdiffusion / IPD' })).toBe('designed');
      expect(distinguishModelOrigin({ category: 'designed_candidate', provider: 'ProteinMPNN' })).toBe('designed');
      // Synthetic Calibration
      expect(distinguishModelOrigin({ provider: 'Synthetic Secondary Structure Generator' })).toBe('synthetic_calibration');
    });

    it('enforces that isExperimental is strictly false for predicted and designed models', () => {
      const predProv = createModelProvenance({
        provider: 'alphafold_db',
        modelName: 'AlphaFold2-v4',
        epistemicOrigin: 'predicted',
        sequence: 'MKWVTFISLLLLFSSAYSRG',
      });
      expect(predProv.isExperimental).toBe(false);

      const designProv = createModelProvenance({
        provider: 'rfdiffusion',
        modelName: 'RFdiffusion-v1.1',
        epistemicOrigin: 'designed',
        sequence: 'MDSEVAELAKKLAEELAKKH',
      });
      expect(designProv.isExperimental).toBe(false);
    });

    it('preserves experimental resolution exclusively for experimental structures (4HHB, 1BNA)', () => {
      const hhb = STRUCTURE_REGISTRY['4HHB'];
      expect(hhb.kind).toBe('experimental');
      expect(hhb.resolution).toBe('1.74 Å');

      const bna = STRUCTURE_REGISTRY['1BNA'];
      expect(bna.kind).toBe('experimental');
      expect(bna.resolution).toBe('1.90 Å');

      const rfd = STRUCTURE_REGISTRY['RFD-BINDER-01'];
      expect(rfd.kind).toBe('designed');
      expect(rfd.resolution).toBeUndefined();
      expect(rfd.computationalMetric).toContain('scTM 0.94');

      const afHba = STRUCTURE_REGISTRY['AF-P69905-F1'];
      expect(afHba.kind).toBe('predicted');
      expect(afHba.resolution).toContain('pLDDT');
      expect(afHba.computationalMetric).toContain('pLDDT 98.4');
    });
  });

  describe('2. ProteinMPNN Inverse-Folding Sequence Design', () => {
    it('validates backbone geometry for CA-CA physical distances (~3.8 Å)', () => {
      const validBackbone = buildHelicalBackbone(10);
      const validation = validateBackboneGeometry(validBackbone);
      expect(validation.isValid).toBe(true);
      expect(validation.violations.length).toBe(0);
      expect(validation.meanDistance).toBeGreaterThan(3.5);
      expect(validation.meanDistance).toBeLessThan(4.0);

      // Unphysical distorted backbone: distance of 6.5 Å between atoms 1 and 2
      const distortedBackbone: Array<[number, number, number]> = [
        [0, 0, 0],
        [0, 0, 3.8],
        [0, 0, 10.3], // 6.5 A jump!
      ];
      const distVal = validateBackboneGeometry(distortedBackbone);
      expect(distVal.isValid).toBe(false);
      expect(distVal.violations).toContain(1);
    });

    it('strictly preserves fixed residues and enforces omitted amino acids', () => {
      const backbone = buildHelicalBackbone(12);
      const origSeq = 'MKWVTFISLLLL';
      const fixedIndices = [0, 4, 11]; // M, T, L must be preserved
      const omitted = ['C', 'M', 'W']; // Forbid CYS, MET, TRP from designable positions

      const res = runProteinMpnnDesign({
        backboneCoordinates: backbone,
        originalSequence: origSeq,
        fixedResidues: fixedIndices,
        omittedAminoAcids: omitted,
        samplingTemperature: 0.1,
        randomSeed: 12345,
      });

      expect(res.fixedPositionsPreserved).toBe(true);
      expect(res.designedSequence[0]).toBe('M');
      expect(res.designedSequence[4]).toBe('T');
      expect(res.designedSequence[11]).toBe('L');

      // Verify that no omitted amino acids appear in non-fixed positions
      for (let i = 0; i < 12; i++) {
        if (!fixedIndices.includes(i)) {
          expect(omitted).not.toContain(res.designedSequence[i]);
        }
      }
    });

    it('guarantees exact deterministic reproducibility with identical random seeds', () => {
      const backbone = buildHelicalBackbone(10);
      const origSeq = 'MKWVTFISLL';

      const run1 = runProteinMpnnDesign({
        backboneCoordinates: backbone,
        originalSequence: origSeq,
        randomSeed: 9999,
        samplingTemperature: 0.2,
      });

      const run2 = runProteinMpnnDesign({
        backboneCoordinates: backbone,
        originalSequence: origSeq,
        randomSeed: 9999,
        samplingTemperature: 0.2,
      });

      expect(run1.designedSequence).toBe(run2.designedSequence);
      expect(run1.logProbabilityScore).toBe(run2.logProbabilityScore);
      expect(run1.perplexity).toBe(run2.perplexity);
    });

    it('enforces honest score semantics: labels output as log-probability score, NOT thermodynamic ΔG', () => {
      const backbone = buildHelicalBackbone(8);
      const origSeq = 'MKWVTFIS';

      const res = runProteinMpnnDesign({
        backboneCoordinates: backbone,
        originalSequence: origSeq,
      });

      expect(res.logProbabilityScore).toBeLessThanOrEqual(0);
      expect(res.perplexity).toBeGreaterThan(0);
      expect(res.scientificCaveats.some((c) => c.includes('Log-probability score represents sequence-structure likelihood'))).toBe(true);
      expect(res.scientificCaveats.some((c) => c.includes('NOT thermodynamic free energy (ΔG)'))).toBe(true);
    });
  });

  describe('3. RFdiffusion Contig Specification & Backbone Generation', () => {
    it('parses complex contig specifications into scaffold and generated gap segments', () => {
      const spec = '10-25/A1-20/15-30';
      const contigs = parseRfdiffusionContigSpec(spec);

      expect(contigs.length).toBe(3);
      expect(contigs[0].type).toBe('generated_gap');
      expect(contigs[0].lengthMin).toBe(10);
      expect(contigs[0].lengthMax).toBe(25);

      expect(contigs[1].type).toBe('scaffold');
      expect(contigs[1].chainId).toBe('A');
      expect(contigs[1].startResidue).toBe(1);
      expect(contigs[1].endResidue).toBe(20);

      expect(contigs[2].type).toBe('generated_gap');
      expect(contigs[2].lengthMin).toBe(15);
      expect(contigs[2].lengthMax).toBe(30);
    });

    it('rejects malformed contig syntax', () => {
      expect(() => parseRfdiffusionContigSpec('')).toThrow(/empty/);
      expect(() => parseRfdiffusionContigSpec('A30-10')).toThrow(/start residue \(30\) > end residue \(10\)/);
      expect(() => parseRfdiffusionContigSpec('invalid_token')).toThrow(/Unrecognized contig token/);
    });

    it('validates hotspot constraints against target receptor residues', () => {
      const knownResidues = [
        { chain: 'A', residueNumber: 25 },
        { chain: 'A', residueNumber: 26 },
        { chain: 'A', residueNumber: 27 },
      ];

      const validHotspots = [{ chain: 'A', residueNumber: 26 }];
      const val1 = validateHotspotConstraints(validHotspots, knownResidues);
      expect(val1.isValid).toBe(true);
      expect(val1.missingHotspots.length).toBe(0);

      const invalidHotspots = [
        { chain: 'A', residueNumber: 26 },
        { chain: 'B', residueNumber: 50 }, // Missing
      ];
      const val2 = validateHotspotConstraints(invalidHotspots, knownResidues);
      expect(val2.isValid).toBe(false);
      expect(val2.missingHotspots).toEqual([{ chain: 'B', residueNumber: 50 }]);
    });

    it('generates continuous C-alpha backbones and enforces backbone-only caveats', () => {
      const res = runRfdiffusionBackboneGeneration({
        contigSpec: '15-20/15-20',
        randomSeed: 777,
      });

      expect(res.isBackboneOnly).toBe(true);
      expect(res.epistemicOrigin).toBe('generated_backbone');
      expect(res.totalResidues).toBeGreaterThanOrEqual(30);
      expect(res.caCoordinates.length).toBe(res.totalResidues);
      expect(res.backbonePdb).toContain('RFDIFFUSION SE(3) GENERATED BACKBONE');
      expect(res.scientificCaveats.some((c) => c.includes('C-alpha coordinates only; no sidechains'))).toBe(true);
    });
  });

  describe('4. Docking Pose Provenance & Non-Protein Biopolymer Guards', () => {
    it('audits docking pose provenance and identifies severe receptor clashes', () => {
      // Receptor: 2 atoms (chain A, res 10)
      const receptorAtoms = [
        { element: 'C', coords: [10.0, 10.0, 10.0] as [number, number, number], chainId: 'A', resSeq: 10 },
        { element: 'O', coords: [10.0, 11.2, 10.0] as [number, number, number], chainId: 'A', resSeq: 10 },
      ];

      // Ligand pose placed 1.2 A away (severe clash with C: rC=1.7, sumVdw=3.4, dist=1.2, overlap=2.2 A)
      const clashingLigand = [
        { element: 'C', coords: [10.0, 10.0, 11.2] as [number, number, number], atomName: 'C1' },
      ];

      const res = auditDockingPose({
        receptorId: '4HHB',
        ligandId: 'HEM',
        dockingEngine: 'AutoDock Vina',
        engineVersion: '1.2.5',
        poseRank: 1,
        rawScore: -8.4,
        receptorAtoms,
        ligandAtoms: clashingLigand,
      });

      expect(res.isExperimentalAffinity).toBe(false);
      expect(res.dockingScore).toBe(-8.4);
      expect(res.severeClashes).toBe(true);
      expect(res.receptorClashCount).toBeGreaterThan(0);
    });

    it('strictly rejects nucleic acid receptors (1BNA) from protein-only docking pipelines', () => {
      const dummyReceptor = [
        { element: 'P', coords: [0, 0, 0] as [number, number, number], chainId: 'A', resSeq: 1 },
      ];
      const dummyLigand = [
        { element: 'C', coords: [5, 5, 5] as [number, number, number], atomName: 'C1' },
      ];

      expect(() =>
        auditDockingPose({
          receptorId: '1BNA',
          ligandId: 'LIG',
          dockingEngine: 'AutoDock Vina',
          engineVersion: '1.2.5',
          poseRank: 1,
          rawScore: -5.0,
          receptorAtoms: dummyReceptor,
          ligandAtoms: dummyLigand,
          isNucleicReceptor: true, // 1BNA is DNA
        })
      ).toThrow(BiopolymerMismatchError);
    });
  });

  describe('5. Structural Plausibility & Geometric Validation of De Novo Models', () => {
    it('flags non-finite coordinates (NaN/Infinity) as UNPHYSICAL_CLASHES', () => {
      const atoms = [
        { element: 'C', atomName: 'CA', coords: [0, 0, NaN] as [number, number, number], resSeq: 1, chainId: 'A' },
      ];
      const res = validateStructuralPlausibility(atoms);
      expect(res.status).toBe('UNPHYSICAL_CLASHES');
      expect(res.details.some((d) => d.includes('Non-finite coordinate'))).toBe(true);
    });

    it('flags peptide bond distortions and non-bonded steric clashes', () => {
      // 3 consecutive CA atoms on Chain A:
      // CA1 at (0, 0, 0)
      // CA2 at (0, 0, 3.8) -> valid (3.8 A)
      // CA3 at (0, 0, 9.5) -> distorted (5.7 A jump!)
      // Plus an unbonded atom CA10 on Chain A at (0, 0, 1.0) -> severe clash with CA1 (1.0 A apart, non-bonded)
      const atoms = [
        { element: 'C', atomName: 'CA', coords: [0, 0, 0] as [number, number, number], resSeq: 1, chainId: 'A' },
        { element: 'C', atomName: 'CA', coords: [0, 0, 3.8] as [number, number, number], resSeq: 2, chainId: 'A' },
        { element: 'C', atomName: 'CA', coords: [0, 0, 9.5] as [number, number, number], resSeq: 3, chainId: 'A' },
        { element: 'C', atomName: 'CA', coords: [0, 0, 1.0] as [number, number, number], resSeq: 10, chainId: 'A' },
      ];

      const res = validateStructuralPlausibility(atoms);
      expect(res.status).toBe('UNPHYSICAL_CLASHES');
      expect(res.peptideBondViolations).toBe(1);
      expect(res.stericClashCount).toBeGreaterThan(0);
    });

    it('classifies a well-formed model as PLAUSIBLE', () => {
      const helicalCA = buildHelicalBackbone(10);
      const atoms = helicalCA.map((coords, i) => ({
        element: 'C',
        atomName: 'CA',
        coords,
        resSeq: i + 1,
        chainId: 'A',
      }));

      const res = validateStructuralPlausibility(atoms);
      expect(res.status).toBe('PLAUSIBLE');
      expect(res.peptideBondViolations).toBe(0);
      expect(res.stericClashCount).toBe(0);
    });
  });

  describe('6. Design Lineage DAG & Cryptographic Digests', () => {
    it('maintains continuous directed lineage from parent scaffold to designed candidate', () => {
      const graph = new DesignLineageGraph();

      // Stage 1: Parent Scaffold
      const node1 = graph.addNode(
        'parent_scaffold',
        'PDB_Scaffold',
        '1.0',
        'ATOM 1 CA ALA A 1 ...',
        { scaffoldPdbId: '4HHB' },
        undefined,
        undefined,
        'Initial human deoxyhemoglobin crystal scaffold'
      );

      // Stage 2: Generated Backbone
      const node2 = graph.addNode(
        'generated_backbone',
        'RFdiffusion',
        'v1.1',
        'ATOM 1 CA GLY A 1 ...',
        { contig: '10-20/A1-15/10-20', steps: 50 },
        node1.nodeId,
        42,
        'SE(3) diffusion generated backbone'
      );

      // Stage 3: Designed Sequence
      const node3 = graph.addNode(
        'designed_sequence',
        'ProteinMPNN',
        'v_48_020',
        'MDSEVAELAKKLAEELAKKH',
        { temperature: 0.1, fixedPositions: [0] },
        node2.nodeId,
        999,
        'Autoregressively redesigned sequence'
      );

      // Verify ancestry
      const lineage = graph.getAncestralLineage(node3.nodeId);
      expect(lineage.length).toBe(3);
      expect(lineage[0].stage).toBe('parent_scaffold');
      expect(lineage[1].stage).toBe('generated_backbone');
      expect(lineage[2].stage).toBe('designed_sequence');

      const continuity = graph.verifyLineageContinuity(node3.nodeId);
      expect(continuity.isContinuous).toBe(true);
      expect(continuity.depth).toBe(3);
    });

    it('rejects invalid or broken lineage parent references', () => {
      const graph = new DesignLineageGraph();
      expect(() =>
        graph.addNode(
          'designed_sequence',
          'ProteinMPNN',
          '1.0',
          'MKWVTFIS',
          {},
          'non_existent_parent_node'
        )
      ).toThrow(/does not exist in lineage graph/);
    });
  });

  describe('7. Adversarial Negative Control Tests & Terminology Audits', () => {
    it('detects and flags prohibited hype claims in model reports', () => {
      const badText = 'This de novo structure is an experimentally verified ground truth structure with true binding pose.';
      const audit = assertScientificallyDefensibleTerminology(badText);

      expect(audit.isClean).toBe(false);
      expect(audit.violations).toContain('experimentally verified');
      expect(audit.violations).toContain('ground truth structure');
      expect(audit.violations).toContain('true binding pose');

      const cleanText = 'This de novo structure is a computationally predicted model with predicted docking hypothesis.';
      const cleanAudit = assertScientificallyDefensibleTerminology(cleanText);
      expect(cleanAudit.isClean).toBe(true);
    });

    it('fails ProteinMPNN gracefully when all amino acids are omitted', () => {
      const backbone = buildHelicalBackbone(5);
      expect(() =>
        runProteinMpnnDesign({
          backboneCoordinates: backbone,
          originalSequence: 'MKWVT',
          omittedAminoAcids: 'ACDEFGHIKLMNPQRSTVWY'.split(''),
        })
      ).toThrow(/All 20 amino acids were omitted/);
    });
  });
});
