// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import {
  motionDurations,
  motionEasings,
  motionSpatial,
  MOTION_REGISTRY,
  useReducedMotion,
  triggerVerificationPulse,
} from '../motion';

// Component helper for testing useReducedMotion hook
const ReducedMotionProbe: React.FC<{ onResult: (val: boolean) => void }> = ({ onResult }) => {
  const isReduced = useReducedMotion();
  React.useEffect(() => {
    onResult(isReduced);
  }, [isReduced, onResult]);
  return <div data-testid="reduced-motion-probe">{String(isReduced)}</div>;
};

describe('MOCS-Cert Motion System & Tokens Suite (Pass 44)', () => {
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

  it('1. exports compliant duration tokens within scientific interaction budget', () => {
    expect(motionDurations.fast).toBeGreaterThanOrEqual(0.08);
    expect(motionDurations.fast).toBeLessThanOrEqual(0.12);

    expect(motionDurations.standard).toBeGreaterThanOrEqual(0.15);
    expect(motionDurations.standard).toBeLessThanOrEqual(0.22);

    expect(motionDurations.slow).toBeGreaterThanOrEqual(0.25);
    expect(motionDurations.slow).toBeLessThanOrEqual(0.35);
  });

  it('2. exports approved scientific easing curves without bouncy or elastic artifacts', () => {
    expect(motionEasings.easeOut).toBe('power2.out');
    expect(motionEasings.easeEmphasis).toBe('expo.out');
    expect(motionEasings.easeSmooth).toBe('sine.out');
    expect(motionEasings.easeOut).not.toContain('bounce');
    expect(motionEasings.easeOut).not.toContain('elastic');
  });

  it('3. enforces tactile pressed scale of 0.98 without exaggerated deformation', () => {
    expect(motionSpatial.pressedScale).toBe(0.98);
    expect(motionSpatial.enterDistanceY).toBe(6);
    expect(motionSpatial.staggerStep).toBe(0.03);
  });

  it('4. contains single-owner animation registry covering all primary components', () => {
    expect(MOTION_REGISTRY.length).toBeGreaterThanOrEqual(6);
    const owners = new Set(MOTION_REGISTRY.map((r) => r.owner));
    expect(owners.has('GSAP')).toBe(true);
    expect(owners.has('Anime.js')).toBe(true);

    // Verify each declaration has valid rationale and property definitions
    for (const record of MOTION_REGISTRY) {
      expect(record.component).toBeTruthy();
      expect(record.property).toBeTruthy();
      expect(record.duration).toBeGreaterThan(0);
      expect(record.rationale).toBeTruthy();
    }
  });

  it('5. useReducedMotion hook respects matchMedia settings and defaults to false', async () => {
    let captured = true;
    await act(async () => {
      root.render(
        <ReducedMotionProbe
          onResult={(val) => {
            captured = val;
          }}
        />
      );
    });

    expect(captured).toBe(false);
    expect(container.textContent).toContain('false');
  });

  it('6. triggerVerificationPulse safely runs on valid element without crashing', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => triggerVerificationPulse(el)).not.toThrow();
    el.remove();
  });
});
