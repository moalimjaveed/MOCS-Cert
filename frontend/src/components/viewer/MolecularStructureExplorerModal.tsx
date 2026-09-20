import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  ExternalLink,
  Database,
  Cpu,
  Sparkles,
  Activity,
  Check,
  FolderOpen,
  Dna,
} from 'lucide-react';
import { useViewerStore } from '../../store/useViewerStore';
import {
  STRUCTURE_CATEGORIES,
  searchRegistry,
  getAllStructures,
} from '../../molecular/data/structureRegistry';
import type { StructureMetadata, StructureCategory } from '../../molecular/types';

export const MolecularStructureExplorerModal: React.FC = () => {
  const isExplorerOpen = useViewerStore((s) => s.isExplorerOpen);
  const closeExplorer = useViewerStore((s) => s.closeExplorer);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const activeStructureId = useViewerStore((s) => s.activeStructureId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StructureCategory | 'all'>('all');

  // Handle escape key to close modal
  useEffect(() => {
    if (!isExplorerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeExplorer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExplorerOpen, closeExplorer]);

  const structures = useMemo(() => {
    return searchRegistry(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  if (!isExplorerOpen) return null;

  const handleSelect = (id: string) => {
    selectStructure(id);
    closeExplorer();
  };

  const getExternalLink = (struct: StructureMetadata): { url: string; label: string } | null => {
    if (struct.provider === 'RCSB PDB') {
      return {
        url: `https://www.rcsb.org/structure/${struct.id.toUpperCase()}`,
        label: 'RCSB PDB',
      };
    }
    if (struct.provider === 'AlphaFold DB') {
      const accession = (struct as any).accession || struct.id.replace('AF-', '').replace('-F1', '');
      return {
        url: `https://alphafold.ebi.ac.uk/entry/${accession}`,
        label: 'AlphaFold DB',
      };
    }
    return null;
  };

  const getCategoryIcon = (catId: StructureCategory | 'all') => {
    switch (catId) {
      case 'existing_experimental':
        return <Database className="w-3.5 h-3.5" />;
      case 'computed_predicted':
        return <Cpu className="w-3.5 h-3.5" />;
      case 'designed_candidate':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'trajectory_dataset':
        return <Activity className="w-3.5 h-3.5" />;
      default:
        return <FolderOpen className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explorer-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeExplorer();
      }}
    >
      <div className="bg-[#FFFFFF] border border-[#D1D1D1] shadow-2xl rounded-[8px] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-[#1C1C1C]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#005FB8]/10 flex items-center justify-center text-[#005FB8]">
              <Dna className="w-4 h-4" />
            </div>
            <div>
              <h2 id="explorer-modal-title" className="text-sm font-semibold text-[#1C1C1C] tracking-tight">
                Universal Molecular Structure Catalog
              </h2>
              <p className="text-xs text-[#64748B]">
                Explore crystallographic structures, predicted models, de novo binders, and molecular trajectories
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="explorer-modal-close-btn"
            onClick={closeExplorer}
            aria-label="Close modal"
            className="p-1.5 rounded-[4px] text-[#64748B] hover:text-[#1C1C1C] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search + Category Filters */}
        <div className="p-4 border-b border-[#E5E5E5] bg-[#FFFFFF] flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              data-testid="explorer-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, name, organism, or tags (e.g., 4HHB, 1BNA, 1TUP, p53, DNA)..."
              className="w-full h-8.5 pl-9 pr-3 text-xs bg-[#F8FAFC] border border-[#D1D1D1] rounded-[4px] text-[#1C1C1C] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#005FB8] focus:bg-[#FFFFFF] transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              data-testid="explorer-cat-all"
              onClick={() => setSelectedCategory('all')}
              className={`h-8.5 px-3 rounded-[4px] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border ${
                selectedCategory === 'all'
                  ? 'bg-[#005FB8] text-white border-[#005FB8]'
                  : 'bg-[#FFFFFF] text-[#64748B] border-[#D1D1D1] hover:bg-[#F8FAFC] hover:text-[#1C1C1C]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>All ({getAllStructures().length})</span>
            </button>
            {STRUCTURE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                data-testid={`explorer-cat-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-8.5 px-3 rounded-[4px] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer border ${
                  selectedCategory === cat.id
                    ? 'bg-[#005FB8] text-white border-[#005FB8]'
                    : 'bg-[#FFFFFF] text-[#64748B] border-[#D1D1D1] hover:bg-[#F8FAFC] hover:text-[#1C1C1C]'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Structure Cards Grid */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[58vh] bg-[#F8FAFC] grid grid-cols-1 md:grid-cols-2 gap-3">
          {structures.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#64748B] text-xs">
              No matching molecular structures found for &quot;{searchQuery}&quot;. Try searching for &quot;4HHB&quot;, &quot;1BNA&quot;, &quot;1TUP&quot;, &quot;synth_500f&quot;, or &quot;6VXX&quot;.
            </div>
          ) : (
            structures.map((struct) => {
              const isActive = struct.id === activeStructureId;
              const extLink = getExternalLink(struct);

              return (
                <div
                  key={struct.id}
                  data-testid={`structure-card-${struct.id}`}
                  className={`border rounded-[6px] p-3.5 bg-[#FFFFFF] transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'border-[#005FB8] ring-1 ring-[#005FB8] shadow-sm'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-xs'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    {/* Top Row: Badge + Provider */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-[3px] bg-[#005FB8]/10 text-[#005FB8] font-mono font-bold text-[11px] shrink-0">
                          {struct.id}
                        </span>
                        <span className="text-xs font-semibold text-[#1C1C1C] truncate">
                          {struct.name}
                        </span>
                      </div>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-medium shrink-0">
                        {struct.provider}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11.5px] text-[#475569] line-clamp-2 leading-relaxed">
                      {struct.description}
                    </p>

                    {/* Scientific Metadata */}
                    <div className="text-[10.5px] text-[#64748B] flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {struct.organism && (
                        <span>
                          <strong className="font-medium text-[#475569]">Organism:</strong> {struct.organism}
                        </span>
                      )}
                      {struct.method && (
                        <span>
                          <strong className="font-medium text-[#475569]">Method:</strong> {struct.method}
                        </span>
                      )}
                      {(struct.resolution || struct.computationalMetric) && (
                        <span>
                          <strong className="font-medium text-[#475569]">Metric:</strong>{' '}
                          {struct.resolution || struct.computationalMetric}
                        </span>
                      )}
                    </div>

                    {/* Tags / Capability Pills */}
                    {struct.tags && struct.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {struct.tags.slice(0, 5).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-[2px] bg-[#F1F5F9] text-[#64748B] text-[10px] font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                    <div className="flex items-center gap-2">
                      {extLink ? (
                        <a
                          href={extLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#005FB8] hover:underline flex items-center gap-1 font-medium"
                        >
                          <span>{extLink.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[10.5px] text-[#64748B] font-mono">
                          Local Dataset
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      data-testid={`load-structure-${struct.id}`}
                      onClick={() => handleSelect(struct.id)}
                      className={`h-7 px-3 rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#E2E8F0] text-[#475569] cursor-default'
                          : 'bg-[#005FB8] text-white hover:bg-[#004C97] active:bg-[#003E7E]'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#005FB8]" />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>Load in Workstation</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between text-xs text-[#64748B]">
          <span>
            Displaying {structures.length} biomolecular structures & datasets
          </span>
          <button
            type="button"
            onClick={closeExplorer}
            className="h-7 px-3 rounded-[4px] border border-[#D1D1D1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#1C1C1C] font-medium cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
