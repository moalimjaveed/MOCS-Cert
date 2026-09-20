// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { useScanStore, useEvidenceStore, useTimelineStore, useUIStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('LeftSidebar Forensic Navigation Rail Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Reset stores to default clean states
    act(() => {
      useUIStore.setState({ isSidebarCollapsed: false, activeEvidenceTab: 'lattice' });
      useScanStore.setState({ trajectoryId: 'synth_500f.xtc', topologyId: 'synth_500f.gro' });
      useEvidenceStore.setState({ queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å' });
      useTimelineStore.setState({ selectedBlockId: 41 });
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all 7 scientific workflow groups in strict sequence', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const rail = container.querySelector('[data-testid="left-navigation-rail"]') as HTMLElement;
    expect(rail).not.toBeNull();
    expect(rail.className).toContain('w-[230px]');

    // Check presence of all 7 scientific workflow groups
    expect(container.querySelector('[data-testid="nav-group-project"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-dataset"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-observables"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-index"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-verification"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-benchmarks"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-group-help"]')).not.toBeNull();

    // Verify headers text
    const textContent = rail.textContent || '';
    expect(textContent).toContain('Project');
    expect(textContent).toContain('Dataset');
    expect(textContent).toContain('Analysis');
    expect(textContent).toContain('Index');
    expect(textContent).toContain('Verification');
    expect(textContent).toContain('Benchmarks');
    expect(textContent).toContain('Help');
  });

  it('renders consolidated dataset resource row showing both trajectory and topology filenames', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    // Single canonical Dataset item — not two separate items
    const datasetBtn = container.querySelector('[data-testid="nav-item-dataset"]') as HTMLElement;
    expect(datasetBtn).not.toBeNull();
    expect(datasetBtn.textContent).toContain('Dataset');
    expect(datasetBtn.textContent).toContain('synth_500f.xtc');
    expect(datasetBtn.textContent).toContain('synth_500f.gro');

    // The old duplicate entries must NOT be present
    expect(container.querySelector('[data-testid="nav-item-trajectory"]')).toBeNull();
    expect(container.querySelector('[data-testid="nav-item-topology"]')).toBeNull();

    // Unified Segoe UI font used for dataset identifiers (no font-cascadia)
    const cascadiaElements = container.querySelectorAll('.font-cascadia');
    expect(cascadiaElements.length).toBe(0);
  });

  it('guarantees fixed icon column width (w-5 h-5 mr-2.5) for uniform label baseline alignment', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const navButtons = container.querySelectorAll('button[role="menuitem"]');
    expect(navButtons.length).toBeGreaterThanOrEqual(10);

    navButtons.forEach((btn) => {
      const iconWrapper = btn.querySelector('div.w-5.h-5');
      expect(iconWrapper).not.toBeNull();
      expect(iconWrapper?.className).toContain('mr-2.5');
      expect(iconWrapper?.className).toContain('shrink-0');
    });
  });

  it('applies native WinUI 3 selected state indicator (#005FB8 thin left accent) on active item', async () => {
    await act(async () => {
      root.render(<LeftSidebar activeId="distance" />);
    });

    const distanceBtn = container.querySelector('[data-testid="nav-item-distance"]') as HTMLElement;
    expect(distanceBtn).not.toBeNull();
    expect(distanceBtn.className).toContain('bg-[#EEF4FA]');
    expect(distanceBtn.className).toContain('font-semibold');
    expect(distanceBtn.className).toContain('border-l-2');
    expect(distanceBtn.className).toContain('border-[#005FB8]');

    // No giant rounded pill background or card
    expect(distanceBtn.className).not.toContain('rounded-full');
    expect(distanceBtn.className).not.toContain('rounded-xl');
  });

  it('handles observable item clicks with reactive store updates', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const contactBtn = container.querySelector('[data-testid="nav-item-contact"]') as HTMLElement;
    expect(contactBtn).not.toBeNull();

    await act(async () => {
      contactBtn.click();
    });

    // Check store updates
    expect(useEvidenceStore.getState().queryText).toContain('FIND CONTACT(PHE89, LIG)');
    expect(useTimelineStore.getState().selectedBlockId).toBe(85);

    const hbondBtn = container.querySelector('[data-testid="nav-item-hbond"]') as HTMLElement;
    await act(async () => {
      hbondBtn.click();
    });

    expect(useEvidenceStore.getState().queryText).toContain('FIND HBOND(TYR151:OH, LIG:1:O2)');
    expect(useTimelineStore.getState().selectedBlockId).toBe(25);
  });

  it('switches evidence tab on verification and index item selection', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const certBtn = container.querySelector('[data-testid="nav-item-verification"]') as HTMLElement;
    await act(async () => {
      certBtn.click();
    });
    expect(useUIStore.getState().activeEvidenceTab).toBe('certificate');

    const indexBtn = container.querySelector('[data-testid="nav-item-index"]') as HTMLElement;
    await act(async () => {
      indexBtn.click();
    });
    expect(useUIStore.getState().activeEvidenceTab).toBe('lattice');

    const benchBtn = container.querySelector('[data-testid="nav-item-benchmarks"]') as HTMLElement;
    await act(async () => {
      benchBtn.click();
    });
    expect(useUIStore.getState().activeEvidenceTab).toBe('benchmarks');
  });

  it('supports Command Rail Mode (56px) with centered icons and tooltips', async () => {
    act(() => {
      useUIStore.setState({ isSidebarCollapsed: true });
    });

    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const rail = container.querySelector('[data-testid="left-navigation-rail"]') as HTMLElement;
    expect(rail.className).toContain('w-14');
    expect(rail.className).toContain('min-w-[56px]');

    const distanceBtn = container.querySelector('[data-testid="nav-item-distance"]') as HTMLElement;
    expect(distanceBtn.getAttribute('title')).toBe('Distance');
    expect(distanceBtn.className).toContain('justify-center');
  });

  it('pins compact footer to bottom with MOCS-Cert version and authorship', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const footer = container.querySelector('[data-testid="sidebar-footer"]') as HTMLElement;
    expect(footer).not.toBeNull();
    expect(footer.className).toContain('shrink-0');
    expect(footer.className).toContain('border-t');
    expect(footer.textContent).toContain('MOCS-Cert v0.1.0');
    expect(footer.textContent).toContain('By Moalim Javeed');
  });

  it('strictly excludes AI-slop: zero emojis, zero colored dots, zero card wrappers', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const fullText = container.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(fullText)).toBe(false);

    // No decorative colored dots (.rounded-full outside of the 3px active indicator)
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);
  });

  it('supports mobile drawer mode with backdrop and auto-close on selection', async () => {
    act(() => {
      useUIStore.setState({ isMobileNavOpen: false });
    });

    await act(async () => {
      root.render(<LeftSidebar />);
    });

    // When closed, backdrop does not exist and rail has hidden lg:flex
    expect(container.querySelector('[data-testid="left-sidebar-backdrop"]')).toBeNull();
    const rail = container.querySelector('[data-testid="left-navigation-rail"]') as HTMLElement;
    expect(rail.className).toContain('hidden');
    expect(rail.className).toContain('lg:flex');

    // Open mobile nav
    act(() => {
      useUIStore.setState({ isMobileNavOpen: true });
    });

    await act(async () => {
      root.render(<LeftSidebar />);
    });

    // Backdrop is present
    const backdrop = container.querySelector('[data-testid="left-sidebar-backdrop"]') as HTMLElement;
    expect(backdrop).not.toBeNull();

    // Rail has fixed drawer classes
    expect(rail.className).toContain('fixed');
    expect(rail.className).toContain('z-50');

    // Clicking close button closes the drawer
    const closeBtn = container.querySelector('[data-testid="close-left-sidebar-btn"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn.click();
    });
    expect(useUIStore.getState().isMobileNavOpen).toBe(false);

    // Re-open and test auto-close on item selection
    act(() => {
      useUIStore.setState({ isMobileNavOpen: true });
    });
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const contactBtn = container.querySelector('[data-testid="nav-item-contact"]') as HTMLElement;
    await act(async () => {
      contactBtn.click();
    });
    expect(useUIStore.getState().isMobileNavOpen).toBe(false);
  });
});
