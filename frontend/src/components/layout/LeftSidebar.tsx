import React, { useRef } from 'react';
import {
  Compass,
  Database,
  FileCode,
  Activity,
  Box,
  Link2,
  Layers,
  ShieldCheck,
  BarChart3,
  Workflow,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useScanStore, useUIStore } from '../../store';
import { useMocsAnimation, gsap } from '../../motion';
import { CANONICAL_NAVIGATION_SECTIONS } from '../../navigation/navigationRegistry';
import { navigateTo } from '../../navigation/router';

export interface LeftSidebarProps {
  className?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
}

/**
 * Canonical Navigation Row Component
 * Unified active state: integrated cobalt left border (border-l-2 #005FB8) + subtle tinted fill (#EEF4FA)
 * Zero detached lines, zero floating cards, optical centering in both expanded and collapsed modes.
 */
interface NavRowProps {
  id: string;
  activeId: string;
  collapsed: boolean;
  icon: React.ReactNode;
  label: string;
  testId: string;
  ariaLabel: string;
  onClick: () => void;
}

const NavRow: React.FC<NavRowProps> = ({
  id,
  activeId,
  collapsed,
  icon,
  label,
  testId,
  ariaLabel,
  onClick,
}) => {
  const isActive = activeId === id;
  return (
    <div className="relative group">
      <button
        role="menuitem"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={onClick}
        className={[
          'relative flex items-center w-full rounded-[4px] text-left select-none',
          'transition-colors duration-100 ease-out',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]',
          'interactive-press box-border cursor-pointer',
          collapsed ? 'h-9 w-10 mx-auto justify-center px-0' : 'h-9 px-2.5',
          isActive
            ? 'bg-[#EEF4FA] text-[#1C1C1C] font-semibold border-l-2 border-[#005FB8]'
            : 'text-[#5C5C5C] hover:bg-[#F3F3F3] hover:text-[#1C1C1C] border-l-2 border-transparent',
        ].join(' ')}
      >
        <div
          className={`w-5 h-5 flex items-center justify-center shrink-0 ${
            collapsed ? 'mr-0' : 'mr-2.5'
          } ${isActive ? 'text-[#005FB8]' : 'text-current'}`}
        >
          {icon}
        </div>
        {!collapsed && (
          <span className="truncate text-[13px] leading-tight font-medium">
            {label}
          </span>
        )}
      </button>

      {/* Floating high-contrast tooltip for collapsed icon rail */}
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50
            whitespace-nowrap px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1C1C] rounded-[4px]
            opacity-0 group-hover:opacity-100 transition-opacity duration-100
            shadow-md"
        >
          {ariaLabel}
        </span>
      )}
    </div>
  );
};

/**
 * Dedicated Two-Line Dataset Component
 * Provides structured trajectory/topology metadata without breaking vertical rail rhythm.
 */
interface DatasetRowProps {
  id: string;
  activeId: string;
  collapsed: boolean;
  icon: React.ReactNode;
  label: string;
  filename: string;
  testId: string;
  ariaLabel: string;
  onClick: () => void;
}

const DatasetRow: React.FC<DatasetRowProps> = ({
  id,
  activeId,
  collapsed,
  icon,
  label,
  filename,
  testId,
  ariaLabel,
  onClick,
}) => {
  const isActive = activeId === id;
  return (
    <div className="relative group">
      <button
        role="menuitem"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={onClick}
        className={[
          'relative flex items-center w-full rounded-[4px] text-left select-none',
          'transition-colors duration-100 ease-out',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]',
          'interactive-press box-border cursor-pointer',
          collapsed ? 'h-9 w-10 mx-auto justify-center px-0' : 'h-11 px-2.5',
          isActive
            ? 'bg-[#EEF4FA] text-[#1C1C1C] font-semibold border-l-2 border-[#005FB8]'
            : 'text-[#5C5C5C] hover:bg-[#F3F3F3] hover:text-[#1C1C1C] border-l-2 border-transparent',
        ].join(' ')}
      >
        <div
          className={`w-5 h-5 flex items-center justify-center shrink-0 ${
            collapsed ? 'mr-0' : 'mr-2.5'
          } ${isActive ? 'text-[#005FB8]' : 'text-current'}`}
        >
          {icon}
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] leading-tight font-medium text-[#1C1C1C]">
              {label}
            </span>
            <span className="text-[10px] font-mono text-[#707070] truncate leading-tight mt-0.5">
              {filename}
            </span>
          </div>
        )}
      </button>

      {/* Floating tooltip for collapsed dataset item */}
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50
            whitespace-nowrap px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1C1C] rounded-[4px]
            opacity-0 group-hover:opacity-100 transition-opacity duration-100
            shadow-md"
        >
          {ariaLabel}
        </span>
      )}
    </div>
  );
};

/**
 * Section Header Component
 * Expanded: compact uppercase label with precise tracking
 * Collapsed: subtle hairline divider providing visual grouping without blank gaps
 */
const SectionHeader: React.FC<{ label: string; collapsed: boolean }> = ({
  label,
  collapsed,
}) => {
  if (collapsed) {
    return <div className="border-t border-[#EBEBEB] my-2 mx-1.5" />;
  }
  return (
    <div className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[#707070] uppercase tracking-[0.08em]">
      {label}
    </div>
  );
};

/**
 * Left Navigation Rail — Canonical Domain Map
 *
 * Enforces Architectural Principle:
 * - Sidebar = Domain Map (Major Application Domains)
 * - Page = Object / Workspace
 * - Tabs = Contextual Views of that Object
 * - URL = Single Authoritative Source of Truth
 */
export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  className = '',
  activeId: controlledActiveId,
  onSelect: controlledOnSelect,
}) => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileNavOpen,
    setMobileNavOpen,
    activeSidebarId,
    setActiveSidebarId,
    setDocumentationModalOpen,
  } = useUIStore();
  const trajectoryId = useScanStore((s) => s.trajectoryId);
  const topologyId = useScanStore((s) => s.topologyId);

  const activeId = controlledActiveId !== undefined ? controlledActiveId : activeSidebarId;
  const navRef = useRef<HTMLElement>(null);

  useMocsAnimation(
    (ctx, isReduced) => {
      if (!navRef.current) return;
      const targetWidth = isSidebarCollapsed ? 56 : 230;

      if (isReduced) {
        gsap.set(navRef.current, { width: targetWidth });
        return;
      }

      ctx.add(() => {
        gsap.to(navRef.current, {
          width: targetWidth,
          duration: 0.18,
          ease: 'power2.out',
        });
      });
    },
    { scope: navRef, dependencies: [isSidebarCollapsed] }
  );

  const cleanTraj = trajectoryId?.replace(/^.*[\\/]/, '') || 'synth_500f.xtc';
  const cleanTopo = topologyId?.replace(/^.*[\\/]/, '') || 'synth_500f.gro';

  const handleSelect = (id: string, route: string, isModal?: boolean) => {
    if (isMobileNavOpen) {
      setMobileNavOpen(false);
    }
    setActiveSidebarId(id);
    controlledOnSelect?.(id);

    if (isModal) {
      setDocumentationModalOpen(true);
      return;
    }

    navigateTo(route);
  };

  const getIconForId = (id: string) => {
    switch (id) {
      case 'experiment':
        return <Compass className="w-4 h-4" />;
      case 'dataset':
      case 'trajectory':
        return <Database className="w-4 h-4" />;
      case 'topology':
        return <FileCode className="w-4 h-4" />;
      case 'distance':
        return <Activity className="w-4 h-4" />;
      case 'contact':
        return <Box className="w-4 h-4" />;
      case 'hbond':
        return <Link2 className="w-4 h-4" />;
      case 'index':
        return <Layers className="w-4 h-4" />;
      case 'verification':
        return <ShieldCheck className="w-4 h-4" />;
      case 'benchmarks':
        return <BarChart3 className="w-4 h-4" />;
      case 'workflows':
        return <Workflow className="w-4 h-4" />;
      case 'docs':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Backdrop on mobile (< lg) when drawer is open */}
      {isMobileNavOpen && (
        <div
          data-testid="left-sidebar-backdrop"
          className="fixed inset-0 top-12 z-40 bg-black/40 lg:hidden transition-opacity"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        ref={navRef}
        data-testid="left-navigation-rail"
        aria-label="Workstation Navigation"
        className={[
          isSidebarCollapsed ? 'w-14 min-w-[56px]' : 'w-[230px] min-w-[230px]',
          'h-full border-r border-[#E5E5E5] bg-[#FFFFFF] flex flex-col shrink-0 select-none text-xs font-sans overflow-hidden',
          isMobileNavOpen
            ? 'fixed left-0 top-12 bottom-0 z-50 shadow-md flex max-w-[85vw]'
            : 'hidden lg:flex',
          className,
        ].join(' ')}
      >
        {/* Zone 1: Pane Header with Collapse/Expand Toggle */}
        <div className="h-10 px-2.5 flex items-center justify-between border-b border-[#E5E5E5] bg-[#FFFFFF] shrink-0">
          {!isSidebarCollapsed && (
            <span className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider pl-1">
              Navigation
            </span>
          )}
          <div className="flex items-center gap-1">
            {/* Desktop collapse/expand toggle */}
            <button
              type="button"
              data-testid="sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label={
                isSidebarCollapsed ? 'Expand navigation pane' : 'Collapse navigation pane'
              }
              title={
                isSidebarCollapsed ? 'Expand navigation pane' : 'Collapse navigation pane'
              }
              className={`hidden lg:flex h-7 w-7 rounded-[4px] items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F3F3F3] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] cursor-pointer ${
                isSidebarCollapsed ? 'mx-auto' : ''
              }`}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {/* Mobile close drawer button */}
            <button
              type="button"
              data-testid="close-left-sidebar-btn"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation pane"
              title="Close navigation"
              className="lg:hidden h-7 w-7 rounded-[4px] flex items-center justify-center text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F3F3F3] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Zone 2: Navigation Scrollable Body */}
        <div className="nav-scroll flex-1 overflow-y-auto py-2 pr-1.5 pl-1.5 space-y-3">
          {CANONICAL_NAVIGATION_SECTIONS.map((sec) => (
            <div key={sec.key} data-testid={sec.testId}>
              <SectionHeader label={sec.label} collapsed={isSidebarCollapsed} />
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  if (item.isDatasetRow) {
                    // Single consolidated Dataset item — show traj filename + topo filename
                    return (
                      <DatasetRow
                        key={item.id}
                        id={item.id}
                        activeId={activeId}
                        collapsed={isSidebarCollapsed}
                        icon={getIconForId(item.id)}
                        label={item.label}
                        filename={`${cleanTraj}  ·  ${cleanTopo}`}
                        testId={item.testId}
                        ariaLabel={`Dataset: ${cleanTraj} and ${cleanTopo}`}
                        onClick={() => handleSelect(item.id, item.canonicalRoute, item.isModalTrigger)}
                      />
                    );
                  }

                  return (
                    <NavRow
                      key={item.id}
                      id={item.id}
                      activeId={activeId}
                      collapsed={isSidebarCollapsed}
                      icon={getIconForId(item.id)}
                      label={item.label}
                      testId={item.testId}
                      ariaLabel={item.ariaLabel}
                      onClick={() => handleSelect(item.id, item.canonicalRoute, item.isModalTrigger)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Zone 3: Pinned Compact Footer */}
        <div
          data-testid="sidebar-footer"
          className="shrink-0 border-t border-[#E5E5E5] bg-[#FFFFFF] px-3 py-2 text-left relative group"
        >
          {!isSidebarCollapsed ? (
            <div>
              <img
                src="/branding/MocsCert_logo.png"
                alt="MOCS-Cert"
                className="h-8 w-full max-w-[204px] object-contain object-left select-none mb-1"
                draggable={false}
              />
              <div className="text-[10px] text-[#707070] leading-tight">
                <span className="sr-only">MOCS-Cert </span>
                v0.1.0 · By Moalim Javeed
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <img
                src="/branding/MocsCert_logo.png"
                alt="MOCS-Cert"
                className="h-4 w-10 object-contain select-none cursor-default"
                draggable={false}
                title="MOCS-Cert v0.1.0 · By Moalim Javeed"
                aria-label="MOCS-Cert v0.1.0"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-full bottom-2 ml-2.5 z-50
                  whitespace-nowrap px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1C1C] rounded-[4px]
                  opacity-0 group-hover:opacity-100 transition-opacity duration-100
                  shadow-md"
              >
                MOCS-Cert v0.1.0 · By Moalim Javeed
              </span>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};
