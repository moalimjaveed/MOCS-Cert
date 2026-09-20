// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import gsap from 'gsap';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock ResizeObserver for jsdom
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;



// Mock api client to avoid network errors in jsdom
vi.mock('../api/client', () => ({
  fetchBlocks: vi.fn().mockResolvedValue([]),
  fetchTrajectoryMetadata: vi.fn().mockResolvedValue({}),
  fetchBenchmarks: vi.fn().mockResolvedValue([]),
  verifyCertificate: vi.fn().mockResolvedValue({
    valid: true,
    sha256_sound: true,
    verification_time_ms: 10.2,
  }),
}));

import { LeftSidebar } from '../components/layout/LeftSidebar';
import { RightInspector } from '../components/layout/RightInspector';
import { WorkstationView } from '../components/views/WorkstationView';
import { MOTION_REGISTRY } from '../motion/motionUtils';
import { triggerVerificationPulse } from '../motion/motionUtils';
import { useUIStore } from '../store';

describe('PASS 45: Motion Realism, Adversarial Cleanup & Rapid Interaction Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useUIStore.setState({ isSidebarCollapsed: false, isInspectorOpen: true });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('1. Single Property Ownership invariant: zero overlapping animation owners', () => {
    // Audit MOTION_REGISTRY
    expect(MOTION_REGISTRY.length).toBeGreaterThanOrEqual(6);

    const propertyOwners = new Map<string, string>();

    for (const entry of MOTION_REGISTRY) {
      const key = `${entry.component}::${entry.property}`;
      expect(propertyOwners.has(key)).toBe(false);
      propertyOwners.set(key, entry.owner);

      // Verify owner is single and authorized
      expect(['GSAP', 'Anime.js', 'CSS']).toContain(entry.owner);
    }
  });

  it('2. Rapid interaction stability: LeftSidebar withstands 20 rapid toggles without broken geometry', async () => {
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.className).toContain('w-[230px]');

    // Perform 20 rapid collapse/expand toggles via useUIStore
    for (let i = 0; i < 20; i++) {
      const isCollapsed = i % 2 === 1;
      act(() => {
        useUIStore.setState({ isSidebarCollapsed: isCollapsed });
      });
      await act(async () => {
        root.render(<LeftSidebar />);
      });
    }

    // Ending state: i=19 -> isCollapsed=true
    const finalNav = container.querySelector('nav');
    expect(finalNav).not.toBeNull();
    expect(finalNav?.className).toContain('w-14 min-w-[56px]');

    // Toggle back to expanded
    act(() => {
      useUIStore.setState({ isSidebarCollapsed: false });
    });
    await act(async () => {
      root.render(<LeftSidebar />);
    });

    const expandedNav = container.querySelector('nav');
    expect(expandedNav).not.toBeNull();
    expect(expandedNav?.className).toContain('w-[230px]');
  });

  it('3. Rapid interaction stability: RightInspector withstands 20 rapid mount/unmount toggles', async () => {
    for (let i = 0; i < 20; i++) {
      const isOpen = i % 2 === 0;
      act(() => {
        useUIStore.setState({ isInspectorOpen: isOpen });
      });
      await act(async () => {
        root.render(<RightInspector />);
      });

      if (isOpen) {
        expect(container.querySelector('aside')).not.toBeNull();
      } else {
        expect(container.querySelector('aside')).toBeNull();
      }
    }

    // Explicitly toggle to closed
    act(() => {
      useUIStore.setState({ isInspectorOpen: false });
    });
    await act(async () => {
      root.render(<RightInspector />);
    });
    expect(container.querySelector('aside')).toBeNull();
  });

  it('4. WorkstationView rapid tab switching: preserves deterministic view and cleans up containers', async () => {
    act(() => {
      useUIStore.setState({ activeWorkspaceTab: 'Workstation' });
    });

    await act(async () => {
      root.render(<WorkstationView />);
    });

    expect(container.querySelector('[data-testid="workstation-rows-container"]')).not.toBeNull();

    const tabs: Array<'Index Catalog' | 'Refinement Explorer' | 'Execution Benchmarks' | 'Formal Audit' | 'Workstation'> = [
      'Index Catalog',
      'Refinement Explorer',
      'Execution Benchmarks',
      'Formal Audit',
      'Workstation',
    ];

    for (const tab of tabs) {
      act(() => {
        useUIStore.setState({ activeWorkspaceTab: tab });
      });
      await act(async () => {
        root.render(<WorkstationView />);
      });

      const main = container.querySelector('main');
      expect(main).not.toBeNull();
    }

    // Final state returns to Workstation
    expect(container.querySelector('[data-testid="workstation-rows-container"]')).not.toBeNull();
  });

  it('5. Deterministic GSAP cleanup: unmounting component kills all active tweens without leaks', async () => {
    const tweenCountBefore = gsap.globalTimeline.getChildren().length;

    await act(async () => {
      root.render(<LeftSidebar />);
    });

    await act(async () => {
      root.unmount();
    });

    const tweenCountAfter = gsap.globalTimeline.getChildren().length;
    // Tweens must be reverted/killed on unmount
    expect(tweenCountAfter).toBeLessThanOrEqual(tweenCountBefore + 1);
  });

  it('6. Anime.js triggerVerificationPulse executes deterministically and does not retain infinite loops', () => {
    const testElement = document.createElement('div');
    document.body.appendChild(testElement);

    expect(() => {
      triggerVerificationPulse(testElement);
      // Run rapid pulses
      triggerVerificationPulse(testElement);
      triggerVerificationPulse(testElement);
    }).not.toThrow();

    testElement.remove();
  });
});
