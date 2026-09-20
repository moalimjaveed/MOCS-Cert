// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { WorkspaceNavBar, WORKSPACE_VIEWS } from '../components/layout/WorkspaceNavBar';

// Enable React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('WorkspaceNavBar Forensic Layout & Alignment Tests', () => {
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

  it('enforces two-tier navigation architecture separating breadcrumbs and tabs', async () => {
    await act(async () => {
      root.render(<WorkspaceNavBar />);
    });
    const bar = container.querySelector('[data-testid="workspace-navbar"]') as HTMLElement;
    expect(bar).not.toBeNull();

    // Height invariant: strictly 60px, never wraps or expands
    expect(bar.className).toContain('h-[60px]');
    expect(bar.className).toContain('min-h-[60px]');
    expect(bar.className).toContain('max-h-[60px]');
    expect(bar.className).toContain('overflow-hidden');

    // Two-tier flex layout
    expect(bar.className).toContain('flex');
    expect(bar.className).toContain('flex-col');

    // Fluent light surface
    expect(bar.className).toContain('bg-[#FFFFFF]');
    expect(bar.className).toContain('border-b');
    expect(bar.className).toContain('border-[#E5E5E5]');
  });

  it('aligns Breadcrumb, Page Title, and Atom Context on a single baseline with no-wrap', async () => {
    await act(async () => {
      root.render(
        <WorkspaceNavBar
          observableType="Distance"
          selectionContext="A:155:CA ↔ LIG:1:O2"
        />
      );
    });

    // Check breadcrumb hierarchy
    expect(container.textContent).toContain('Workspace');
    expect(container.textContent).toContain('Observables');

    // Observable / Page Title
    const titleEl = container.querySelector('[data-testid="observable-title"]') as HTMLElement;
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe('Distance');
    expect(titleEl.className).toContain('font-semibold');
    expect(titleEl.className).toContain('whitespace-nowrap');
    // Ensure it is not a pill or card
    expect(titleEl.className).not.toContain('rounded');
    expect(titleEl.className).not.toContain('bg-');

    // Scientific Atom Context
    const contextEl = container.querySelector('[data-testid="selection-context"]') as HTMLElement;
    expect(contextEl).not.toBeNull();
    expect(contextEl.className).not.toContain('font-cascadia');
    expect(contextEl.className).toContain('text-[#5C5C5C]');
    expect(contextEl.className).toContain('whitespace-nowrap');
    expect(contextEl.className).toContain('truncate');
    expect(contextEl.getAttribute('title')).toBe('A:155:CA ↔ LIG:1:O2');
  });

  it('renders all 6 workspace navigation views with WinUI 3 Fluent tab styling', async () => {
    await act(async () => {
      root.render(<WorkspaceNavBar activeTab="Workstation" />);
    });

    const tabList = container.querySelector('[data-testid="workspace-nav-tabs"]');
    expect(tabList).not.toBeNull();
    expect(tabList?.getAttribute('role')).toBe('tablist');

    const buttons = container.querySelectorAll('[role="tab"]');
    expect(buttons.length).toBe(6);

    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).toEqual([
      'Workstation',
      'Molecular View',
      'Index Catalog',
      'Refinement Explorer',
      'Execution Benchmarks',
      'Formal Audit',
    ]);

    // Active tab ("Workstation") verification:
    const activeTab = Array.from(buttons).find((b) => b.textContent?.trim() === 'Workstation') as HTMLElement;
    expect(activeTab).not.toBeNull();
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
    // Active tab must have bottom accent border line (#005FB8)
    expect(activeTab.className).toContain('border-b-2');
    expect(activeTab.className).toContain('border-[#005FB8]');
    expect(activeTab.className).toContain('font-semibold');
    // Active tab MUST NOT be a large gray rounded pill
    expect(activeTab.className).not.toContain('bg-[#E5E5E5]');
    expect(activeTab.className).not.toContain('rounded');

    // Inactive tabs verification:
    const inactiveTab = Array.from(buttons).find((b) => b.textContent?.trim() === 'Molecular View') as HTMLElement;
    expect(inactiveTab.getAttribute('aria-selected')).toBe('false');
    expect(inactiveTab.className).toContain('border-transparent');
    expect(inactiveTab.className).not.toContain('bg-[#E5E5E5]');
  });

  it('handles tab switching and fires onTabChange callback', async () => {
    const handleTabChange = vi.fn();
    await act(async () => {
      root.render(<WorkspaceNavBar activeTab="Workstation" onTabChange={handleTabChange} />);
    });

    const verificationTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (b) => b.textContent?.trim() === 'Formal Audit'
    ) as HTMLElement;

    expect(verificationTab).not.toBeNull();

    await act(async () => {
      verificationTab.click();
    });

    expect(handleTabChange).toHaveBeenCalledWith('Formal Audit');
  });

  it('safely handles long atom selection identifiers with ellipsis and title tooltip', async () => {
    const longIdentifier = 'PROTEIN_CHAIN_ALPHA_RESIDUE_155:CA ↔ LIGAND_MOLECULE_01:O2';
    await act(async () => {
      root.render(
        <WorkspaceNavBar
          observableType="Distance"
          selectionContext={longIdentifier}
        />
      );
    });

    const contextEl = container.querySelector('[data-testid="selection-context"]') as HTMLElement;
    expect(contextEl).not.toBeNull();
    expect(contextEl.textContent).toBe(longIdentifier);
    expect(contextEl.getAttribute('title')).toBe(longIdentifier);
    expect(contextEl.className).toContain('whitespace-nowrap');
    expect(contextEl.className).toContain('truncate');

    // Ensure parent bar retains strict 60px height invariant
    const bar = container.querySelector('[data-testid="workspace-navbar"]') as HTMLElement;
    expect(bar.className).toContain('h-[60px]');
    expect(bar.className).toContain('max-h-[60px]');
  });

  it('correctly displays alternative observables (Contact, Hydrogen Bond)', async () => {
    await act(async () => {
      root.render(
        <WorkspaceNavBar
          observableType="Hydrogen Bond"
          selectionContext="GLU:122:OE1 ↔ ARG:158:NH1"
        />
      );
    });

    const titleEl = container.querySelector('[data-testid="observable-title"]') as HTMLElement;
    expect(titleEl.textContent).toBe('Hydrogen Bond');

    const contextEl = container.querySelector('[data-testid="selection-context"]') as HTMLElement;
    expect(contextEl.textContent).toBe('GLU:122:OE1 ↔ ARG:158:NH1');
  });

  it('strictly excludes AI-slop: zero emojis, zero colored dots, zero pills', async () => {
    await act(async () => {
      root.render(<WorkspaceNavBar />);
    });

    const fullText = container.textContent || '';
    // No emojis regex
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(fullText)).toBe(false);

    // No colored dot indicators (e.g. rounded-full bg-emerald, bg-rose, etc.)
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(0);

    // No pill classes (rounded-full or large rounded pill buttons)
    const pills = container.querySelectorAll('.rounded-full, .rounded-lg, .rounded-xl');
    expect(pills.length).toBe(0);
  });
});
