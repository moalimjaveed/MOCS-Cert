// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { TopBar } from '../components/layout/TopBar';
import { useScanStore, useUIStore } from '../store';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('TopBar Forensic Header Layout Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('renders fixed 48px height with 6-column grid layout', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });
    const header = container.querySelector('header');
    expect(header).not.toBeNull();

    // Check fixed height classes
    expect(header?.className).toContain('h-12');
    expect(header?.className).toContain('min-h-[48px]');
    expect(header?.className).toContain('max-h-[48px]');

    // Check explicit 5-column Grid layout
    expect(header?.className).toContain('grid');
    expect(header?.className).toContain('grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]');
    expect(header?.className).toContain('overflow-hidden');
  });

  it('preserves single-line whitespace-nowrap and prevents text wrapping', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });
    const header = container.querySelector('header');
    expect(header).not.toBeNull();

    // All 5 columns must have whitespace-nowrap or overflow-hidden
    const children = Array.from(header?.children || []);
    expect(children.length).toBe(5);

    children.forEach((child) => {
      const el = child as HTMLElement;
      expect(el.className).toContain('whitespace-nowrap');
    });
  });

  it('omits fake OS caption buttons from the web app header', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });
    const captionRegion = container.querySelector('[aria-label="Window Caption Controls"]');
    expect(captionRegion).toBeNull();

    const minimizeBtn = container.querySelector('[title="Minimize"]');
    expect(minimizeBtn).toBeNull();
    const closeBtn = container.querySelector('[title="Close"]');
    expect(closeBtn).toBeNull();
  });

  it('does NOT show awkward tooltips for ordinary short filenames (Section 4)', async () => {
    useScanStore.setState({
      trajectoryId: 'synth_500f.xtc',
      topologyId: 'synth_500f.gro',
    });

    await act(async () => {
      root.render(<TopBar />);
    });

    // The short filename is directly legible and has no awkward hover tooltip
    const trajSpans = Array.from(container.querySelectorAll('span'));
    const trajVal = trajSpans.find((s) => s.textContent === 'synth_500f.xtc');
    expect(trajVal).not.toBeUndefined();
    expect(trajVal?.getAttribute('title')).toBeNull();

    const topoVal = trajSpans.find((s) => s.textContent === 'synth_500f.gro');
    expect(topoVal).not.toBeUndefined();
    expect(topoVal?.getAttribute('title')).toBeNull();
  });

  it('handles extremely long filenames without breaking header layout and conditionally applies tooltips (Section 3, 4, 23)', async () => {
    // Inject hostile long filenames
    useScanStore.setState({
      trajectoryId: 'production_equilibrated_protein_ligand_replica_01_100ns.xtc',
      topologyId: 'production_equilibrated_protein_ligand_system_topology.gro',
    });

    await act(async () => {
      root.render(<TopBar />);
    });
    const header = container.querySelector('header');
    expect(header).not.toBeNull();

    // Header height remains rigidly 48px
    expect(header?.className).toContain('h-12');
    expect(header?.className).toContain('overflow-hidden');

    // Filenames must have truncate and conditionally assigned title tooltips
    const trajSpan = container.querySelector('[title="production_equilibrated_protein_ligand_replica_01_100ns.xtc"]');
    expect(trajSpan).not.toBeNull();
    expect(trajSpan?.className).toContain('truncate');

    const topoSpan = container.querySelector('[title="production_equilibrated_protein_ligand_system_topology.gro"]');
    expect(topoSpan).not.toBeNull();
    expect(topoSpan?.className).toContain('truncate');
  });

  it('removes low-value internal implementation details (CPU/NumPy) from header (Section 9)', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });

    // CPU · NumPy must not be in the global header
    expect(container.textContent).not.toContain('NumPy');
    expect(container.textContent).not.toContain('CPU ·');

    // High-value global states must be present
    expect(container.textContent).toContain('Index ready');
    expect(container.textContent).toContain('Source verified');
  });

  it('provides an accessible Inspector toggle button wired to useUIStore', async () => {
    await act(async () => {
      root.render(<TopBar />);
    });

    const toggleBtn = container.querySelector('[data-testid="toggle-inspector-btn"]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('title')).toContain('Toggle Result Inspector');

    expect(useUIStore.getState().isInspectorOpen).toBe(true);

    // Click toggle button
    await act(async () => {
      toggleBtn.click();
    });

    expect(useUIStore.getState().isInspectorOpen).toBe(false);

    // Click toggle button again
    await act(async () => {
      toggleBtn.click();
    });

    expect(useUIStore.getState().isInspectorOpen).toBe(true);
  });

  it('provides a mobile navigation toggle button wired to toggleMobileNav in useUIStore', async () => {
    act(() => {
      useUIStore.setState({ isMobileNavOpen: false });
    });

    await act(async () => {
      root.render(<TopBar />);
    });

    const mobileBtn = container.querySelector('[data-testid="mobile-nav-toggle-btn"]') as HTMLButtonElement;
    expect(mobileBtn).not.toBeNull();
    expect(mobileBtn.getAttribute('aria-label')).toBe('Toggle navigation menu');

    await act(async () => {
      mobileBtn.click();
    });
    expect(useUIStore.getState().isMobileNavOpen).toBe(true);

    await act(async () => {
      mobileBtn.click();
    });
    expect(useUIStore.getState().isMobileNavOpen).toBe(false);
  });
});
