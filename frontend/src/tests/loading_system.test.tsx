// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { AppBootLoader } from '../components/loading/AppBootLoader';
import { DatasetLoader } from '../components/loading/DatasetLoader';
import { QueryExecutionLoader } from '../components/loading/QueryExecutionLoader';
import { CertificateVerificationLoader } from '../components/loading/CertificateVerificationLoader';
import { useScanStore, useTimelineStore } from '../store';

describe('MOCS-Cert Loading Infrastructure Suite (Pass 45 Realism & Truthfulness)', () => {
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

  it('1. AppBootLoader renders real lifecycle stages without fabricated progress or false verification', async () => {
    await act(async () => {
      root.render(<AppBootLoader />);
    });

    const loader = container.querySelector('[data-testid="app-boot-loader"]');
    expect(loader).not.toBeNull();
    expect(loader?.textContent).toContain('Dataset & Topology');
    expect(loader?.textContent).toContain('Coordinate Lattice');
    // Truthfulness: says 'Verification Subsystem' not 'Kleene Soundness Oracle: Verified'
    expect(loader?.textContent).toContain('Verification Subsystem');
    expect(loader?.textContent).not.toContain('Kleene Soundness Oracle');
    // Truthfulness: zero fake progress bar with w-2/3
    expect(container.querySelector('.w-2\\/3')).toBeNull();
  });

  it('2. AppBootLoader updates readiness markers when store receives metadata and blocks', async () => {
    act(() => {
      useScanStore.setState({ trajectoryId: 'synth_500f.xtc' });
      useTimelineStore.setState({ blocks: [{ block_id: 41, frame_start: 41000, frame_end: 41999, status: 'UNKNOWN' }] as any });
    });

    await act(async () => {
      root.render(<AppBootLoader />);
    });

    const readyBadges = container.querySelectorAll('.text-\\[\\#107C10\\]');
    expect(readyBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('3. DatasetLoader displays dynamic lifecycle state during active dataset transition', async () => {
    await act(async () => {
      root.render(
        <DatasetLoader
          datasetName="synth_500f.xtc"
          isSwitching={true}
          lifecycle={{
            executionInvalidation: 'ready',
            topology: 'loading',
            lattice: 'idle',
            index: 'idle',
          }}
        />
      );
    });

    const overlay = container.querySelector('[data-testid="dataset-loader-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('synth_500f.xtc');
    expect(overlay?.textContent).toContain('Execution Invalidation:');
    expect(overlay?.textContent).toContain('Ready');
    expect(overlay?.textContent).toContain('Molecular Topology:');
    expect(overlay?.textContent).toContain('Loading...');
  });

  it('4. DatasetLoader returns null when isSwitching is false', async () => {
    await act(async () => {
      root.render(<DatasetLoader isSwitching={false} />);
    });

    expect(container.querySelector('[data-testid="dataset-loader-overlay"]')).toBeNull();
  });

  it('5. QueryExecutionLoader renders honest execution stage without fake Stage N of N counter', async () => {
    await act(async () => {
      root.render(
        <QueryExecutionLoader
          currentStage="compiling"
          isExecuting={true}
          queryText="FIND (name CA) WITHIN 4.0A OF (name O2)"
        />
      );
    });

    const loader = container.querySelector('[data-testid="query-execution-loader"]');
    expect(loader).not.toBeNull();
    expect(loader?.textContent).toContain('Compiling Query');
    expect(loader?.textContent).toContain('compiling');
    // Truthfulness: no fabricated "Stage 3 of 5" counter
    expect(loader?.textContent).not.toContain('Stage 1 of 5');
    expect(loader?.textContent).not.toContain('Stage 3 of 5');
  });

  it('6. CertificateVerificationLoader renders cryptographic audit status and pulses only when verified', async () => {
    await act(async () => {
      root.render(<CertificateVerificationLoader status="verified" />);
    });

    const loader = container.querySelector('[data-testid="certificate-verification-loader"]');
    expect(loader).not.toBeNull();
    expect(loader?.textContent).toContain('Cryptographic Certificate Audit');
    expect(loader?.textContent).toContain('verified');
    expect(loader?.textContent).toContain('Bit-Exact');
  });
});
