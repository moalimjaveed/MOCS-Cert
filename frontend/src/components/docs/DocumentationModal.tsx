import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  X,
  FileText,
  ChevronRight,
  ExternalLink,
  Shield,
  Layers,
  Cpu,
  Code2,
  Terminal,
} from 'lucide-react';
import { useUIStore } from '../../store';

interface DocItem {
  id: string;
  order: string;
  title: string;
  category: string;
  path: string;
  authority: string;
  summary: string;
  sections: { title: string; content: string }[];
}

export const DOCS_CATALOG: DocItem[] = [
  {
    id: 'about',
    order: '00',
    title: 'About MOCS-Cert',
    category: 'Product',
    path: '',
    authority: 'product-provenance',
    summary: 'Product identity, scope, and authorship for the MOCS-Cert scientific workstation.',
    sections: [
      {
        title: 'MOCS-Cert',
        content:
          'Molecular Observability Compiler for Certified Query Execution\n\nMOCS-Cert compiles molecular observability queries over long MD trajectories into certified interval pruning, cryptographic execution certificates, and independent verification workflows.',
      },
      {
        title: 'Authorship',
        content: 'By Moalim Javeed',
      },
    ],
  },
  {
    id: 'readme',
    order: '01',
    title: 'Public Introduction & Architecture Overview',
    category: 'Architecture',
    path: 'docs/README.md',
    authority: 'public-overview',
    summary: 'High-level overview of MOCS-Cert: Molecular Observability Compiler for Certified Query Execution on long MD trajectories.',
    sections: [
      {
        title: 'Core Mission',
        content: 'MOCS-Cert replaces linear frame-by-frame scans in molecular dynamics with certified interval pruning. Queries compiled to abstract syntax trees execute against spatial radix bounding boxes, avoiding decompression of up to 97% of frames.',
      },
      {
        title: 'Three-Tier Verification Architecture',
        content: 'Tier 1: Client Query Execution & Pruning Engine\nTier 2: Independent Machine Proof Auditor\nTier 3: Reference Truth Oracle (MDAnalysis / MDTraj)',
      },
    ],
  },
  {
    id: 'formal-semantics',
    order: '05',
    title: 'Authoritative Epistemic & Operational Semantics',
    category: 'Semantics',
    path: 'docs/FORMAL_SEMANTICS.md',
    authority: 'semantic-definition',
    summary: 'Defines the 3-valued logical truth domain {TRUE, FALSE, UNKNOWN}, execution resolution statuses, and Kleene algebra.',
    sections: [
      {
        title: 'Kleene 3-Valued Truth Domain',
        content: 'Every query predicate evaluates over an interval to one of three epistemic states:\n- TRUE: Predicate is certified to hold across the interval.\n- FALSE: Predicate is certified not to hold across the interval.\n- UNKNOWN: Spatial bounds cannot establish truth; requires coordinate refinement or exact frame sampling.',
      },
      {
        title: 'Quantifier Semantics',
        content: 'EXISTS: True if at least one sampled slot satisfies predicate.\nFORALL: True if all sampled slots within event interval satisfy predicate.',
      },
    ],
  },
  {
    id: 'mathematical-model',
    order: '06',
    title: 'AABB Bounds, PBC Derivations & Cost Objectives',
    category: 'Mathematics',
    path: 'docs/MATHEMATICAL_MODEL.md',
    authority: 'mathematical-proofs',
    summary: 'Defines Euclidean AABB interval bounds, looseness metric G >= 0, and monotonic refinement intervals.',
    sections: [
      {
        title: 'Conservative Distance Bounds',
        content: 'For atom coordinates enclosed in axis-aligned bounding boxes (AABBs) with centers c_i, c_j and radii r_i, r_j:\nL = max(0, ||c_i - c_j|| - r_i - r_j)\nU = ||c_i - c_j|| + r_i + r_j\nSoundness guarantees that for all frames in block: L <= d(t) <= U.',
      },
      {
        title: 'Looseness Invariant G',
        content: 'The looseness gap G = U - L satisfies G = 2(r_i + r_j) >= 0. Under dyadic refinement, r reduces monotonically.',
      },
    ],
  },
  {
    id: 'certificate-spec',
    order: '07',
    title: 'JSON-Schema & Offline Verification Algorithm',
    category: 'Verification',
    path: 'docs/CERTIFICATE_SPEC.md',
    authority: 'certificate-schema',
    summary: 'Defines the machine-verifiable JSON certificate schema, operator-branching verification algorithm, and two-tier trust architecture.',
    sections: [
      {
        title: 'Certificate Schema Structure',
        content: 'A MOCS execution certificate contains:\n1. result: { truth, resolution, quantifier }\n2. semantics: { sampling, pbc, precision }\n3. source: { trajectory_sha256, topology_sha256 }\n4. index_commitment: { mci_index_hash, algorithm }\n5. evidence: { blocks_examined, certified_false, refined_blocks, exact_frames }',
      },
      {
        title: 'Verification Invariant',
        content: 'An independent verifier validates the SHA-256 hash of the certificate and confirms that all claimed pruned blocks have provable bounds outside the query threshold.',
      },
    ],
  },
  {
    id: 'pbc-semantics',
    order: '15',
    title: 'Periodic Boundary Conditions & Minimum-Image Convention',
    category: 'Semantics',
    path: 'docs/PBC_SEMANTICS.md',
    authority: 'pbc-mathematics',
    summary: 'Defines orthorhombic PBC minimum-image conventions, scalar uniqueness, and baseline 2-patch clustering.',
    sections: [
      {
        title: 'Orthorhombic Minimum-Image Convention',
        content: 'Displacement vectors between atoms in an orthorhombic box of dimensions (L_x, L_y, L_z) are wrapped according to:\ndx_pbc = dx - L_x * round(dx / L_x)\nGuaranteed unique when bounding box diameters do not exceed L/2.',
      },
    ],
  },
  {
    id: 'temporal-semantics',
    order: '16',
    title: 'Discrete Event Algebra & Sampled-Frame Grounding',
    category: 'Semantics',
    path: 'docs/TEMPORAL_SEMANTICS.md',
    authority: 'temporal-logic',
    summary: 'Defines half-open event intervals [k_s, k_e), duration (k_e - k_s)*dt, and temporal relations.',
    sections: [
      {
        title: 'Half-Open Interval Semantics',
        content: 'Event durations are modeled as half-open integer frame slot intervals [k_s, k_e). Duration = (k_e - k_s) * Δt. Prevents fencepost counting errors and off-by-one gaps.',
      },
    ],
  },
  {
    id: 'query-language-spec',
    order: '09',
    title: 'MolQL-Cert EBNF Grammar & AST Dataclasses',
    category: 'API & Query',
    path: 'docs/QUERY_LANGUAGE_SPEC.md',
    authority: 'query-syntax',
    summary: 'Formal grammar and syntax rules for MolQL-Cert queries.',
    sections: [
      {
        title: 'Grammar Syntax',
        content: 'FIND <observable> [WHERE <condition>] [WITHIN <range>]\nExamples:\n- FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å\n- FIND CONTACT(PHE89, LIG) < 4.5 Å FOR >= 5.0 ns\n- FIND HBOND(TYR151:OH, LIG:1:O2)',
      },
    ],
  },
  {
    id: 'benchmark-spec',
    order: '18',
    title: 'Dataset Stratification & 10-Baseline Protocols',
    category: 'Benchmarks',
    path: 'docs/BENCHMARK_SPEC.md',
    authority: 'benchmark-methodology',
    summary: 'Defines benchmark methodology and 10-baseline comparison protocol against MDAnalysis, MDTraj, HDF5, and Parquet.',
    sections: [
      {
        title: 'Standard Evaluation Protocol',
        content: 'All benchmarks measure cold-cache performance, I/O volume read from storage, decompression CPU cycles, and coordinate floating point operations.',
      },
    ],
  },
  {
    id: 'api-spec',
    order: '26',
    title: 'Python API Specification (mocs.open/query/verify)',
    category: 'API & Query',
    path: 'docs/API_SPEC.md',
    authority: 'public-api',
    summary: 'Defines user-facing Python API bindings and execution lifecycle.',
    sections: [
      {
        title: 'Core API Calls',
        content: 'import mocs\nsim = mocs.open("traj.xtc", "top.gro")\nquery = sim.query("FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0")\ncertificate = query.execute()\nmocs.verify(certificate)',
      },
    ],
  },
  {
    id: 'system-architecture',
    order: '04',
    title: 'Technical Subsystems & Execution Plans',
    category: 'Architecture',
    path: 'docs/SYSTEM_ARCHITECTURE.md',
    authority: 'system-architecture',
    summary: 'Overview of 5 decoupled engines: UI, 3D Molecular, Temporal, Evidence, and State.',
    sections: [
      {
        title: 'Engine Architecture',
        content: '1. UI Engine: scientific workstation shell and query IDE\n2. 3D Engine: Mol* biopolymer viewer with proof geometry overlays\n3. Time Engine: temporal lattice and block-scoped execution context\n4. Evidence Engine: certificate workspace, MCI commitments, and oracle cross-checks\n5. State Engine: synchronized dataset, proof, and renderer state',
      },
    ],
  },
  {
    id: 'kill-criteria',
    order: '21',
    title: 'Brutally Honest Project Termination Triggers',
    category: 'Governance',
    path: 'docs/KILL_CRITERIA.md',
    authority: 'governance-kill-criteria',
    summary: 'Defines non-negotiable project termination triggers if speedup or soundness invariants fail.',
    sections: [
      {
        title: 'Kill Criteria Invariants',
        content: '1. Soundness Kill Trigger: Any false positive or false negative in certified intervals.\n2. Performance Kill Trigger: Query speedup drops below 5x vs linear scan on 1M frame trajectories.\n3. Storage Kill Trigger: Sidecar index exceeds 15% of raw trajectory size.',
      },
    ],
  },
  {
    id: 'reference-semantics',
    order: '12',
    title: 'Authoritative Reference Oracle (mocs-reference)',
    category: 'Verification',
    path: 'docs/REFERENCE_SEMANTICS.md',
    authority: 'reference-oracle',
    summary: 'Defines the independent mocs-reference differential validation oracle with explicit parameter contracts.',
    sections: [
      {
        title: 'Differential Testing Oracle',
        content: 'Compares exact results frame-by-frame with MDAnalysis and MDTraj under identical float64 precision and minimum-image conventions.',
      },
    ],
  },
];

export const DocumentationModal: React.FC = () => {
  const { isDocumentationModalOpen, setDocumentationModalOpen, activeDocId, setActiveDocId } = useUIStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    DOCS_CATALOG.forEach((d) => cats.add(d.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const filteredDocs = useMemo(() => {
    return DOCS_CATALOG.filter((doc) => {
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      const matchesSearch =
        searchTerm === '' ||
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchTerm]);

  const activeDoc = useMemo(() => {
    return DOCS_CATALOG.find((d) => d.id === activeDocId) || DOCS_CATALOG[0];
  }, [activeDocId]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDocumentationModalOpen) {
        setDocumentationModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDocumentationModalOpen, setDocumentationModalOpen]);

  if (!isDocumentationModalOpen) {
    return null;
  }

  return (
    <div
      data-testid="documentation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 font-sans text-xs select-none"
    >
      <div className="w-full max-w-5xl h-[88vh] max-h-[820px] rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] shadow-2xl overflow-hidden flex flex-col text-[#1C1C1C]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#005FB8]" />
            <span className="font-semibold text-[13px] text-[#1C1C1C]">
              MOCS-Cert Documentation &amp; Specification Library
            </span>
            <span className="text-[10px] text-[#5C5C5C] bg-[#EAEAEA] px-2 py-0.5 rounded-[4px] font-cascadia">
              36 Specifications
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#D1D1D1] px-2.5 py-1 rounded-[4px] text-xs">
              <Search className="w-3.5 h-3.5 text-[#8A8A8A]" />
              <input
                data-testid="docs-search-input"
                type="text"
                placeholder="Search specifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none outline-none text-xs bg-transparent w-48 sm:w-64 placeholder-[#8A8A8A]"
              />
            </div>

            <button
              data-testid="close-docs-btn"
              onClick={() => setDocumentationModalOpen(false)}
              className="w-7 h-7 rounded flex items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#EAEAEA] transition cursor-pointer"
              title="Close Documentation (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Left Navigation & Right Content Reader */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar (Topics & Categories) */}
          <div className="w-[280px] sm:w-[320px] border-r border-[#E5E5E5] bg-[#FAFAFA] flex flex-col shrink-0 overflow-hidden">
            {/* Category Filter Pills */}
            <div className="p-2 border-b border-[#E5E5E5] flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-[3px] text-[11px] whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#005FB8] text-white font-semibold'
                      : 'text-[#5C5C5C] hover:bg-[#EAEAEA]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {filteredDocs.map((doc) => {
                const isSelected = activeDoc.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    data-testid={`doc-item-${doc.id}`}
                    onClick={() => setActiveDocId(doc.id)}
                    className={`w-full text-left p-2 rounded-[4px] transition cursor-pointer flex items-start gap-2 ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#1C1C1C] border-l-2 border-[#005FB8]'
                        : 'text-[#5C5C5C] hover:bg-[#F3F3F3] hover:text-[#1C1C1C]'
                    }`}
                  >
                    <FileText className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-[#005FB8]' : 'text-[#8A8A8A]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[11.5px] truncate">{doc.title}</div>
                      <div className="text-[10px] text-[#707070] truncate mt-0.5">{doc.summary}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FFFFFF] select-text">
            {activeDoc && (
              <>
                {/* Document Header */}
                <div className="border-b border-[#E5E5E5] pb-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-white bg-[#005FB8] px-2 py-0.5 rounded-[3px]">
                      {activeDoc.category}
                    </span>
                    {activeDoc.authority ? (
                      <span className="text-[11px] text-[#5C5C5C] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded-[3px]">
                        Spec · {activeDoc.authority}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-[#0969DA] font-semibold">
                      Authority: {activeDoc.authority}
                    </span>
                  </div>

                  <h2 className="text-[18px] font-bold text-[#1C1C1C] m-0">
                    {activeDoc.title}
                  </h2>
                  <p className="text-[12px] text-[#5C5C5C] m-0 leading-relaxed">
                    {activeDoc.summary}
                  </p>
                </div>

                {activeDoc.id === 'about' && (
                  <img
                    src="/branding/MocsCert_Banner.png"
                    alt="MOCS-Cert"
                    className="block w-full h-auto object-contain"
                  />
                )}

                {/* Document Sections */}
                <div className="space-y-4">
                  {activeDoc.sections.map((sec, idx) => (
                    <div key={idx} className="p-4 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                      <h3 className="text-[13px] font-semibold text-[#0F172A] m-0">
                        {sec.title}
                      </h3>
                      <div className="text-[11.5px] text-[#334155] leading-relaxed whitespace-pre-line font-normal">
                        {sec.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer notes */}
                <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between text-[11px] text-[#8A8A8A]">
                  <span>MOCS-Cert · Molecular Observability Compiler for Certified Query Execution</span>
                  <span>By Moalim Javeed</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
