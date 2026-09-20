/**
 * MOCS-Cert Scientific Workstation Motion Tokens
 * Centralized motion budget, easing curves, spatial offsets, and ownership declarations.
 * Strictly adheres to RULE.md and Pass 44 motion specifications.
 */

export const motionDurations = {
  /** Fast micro-interactions (tooltips, button presses, focus rings): 80-120ms */
  fast: 0.10,
  /** Standard UI state changes (tab transitions, panel toggles, cards): 150-220ms */
  standard: 0.18,
  /** Slow structural transitions (sidebar expand/collapse, modal overlays): 250-350ms */
  slow: 0.28,
  /** Loading step / pulse duration: 800-1200ms */
  shimmer: 1.2,
} as const;

export const motionEasings = {
  /** High precision deceleration for standard scientific state entries */
  easeOut: 'power2.out',
  /** Dramatic entry for focused modals or primary indicators */
  easeEmphasis: 'expo.out',
  /** Smooth continuous curves for timeline scrubbers / camera adjustments */
  easeSmooth: 'sine.out',
  /** Snappy exit curve */
  easeIn: 'power2.in',
  /** Bidirectional symmetric curves */
  easeInOut: 'power2.inOut',
} as const;

export const motionSpatial = {
  /** Subtle vertical translation on enter (px) */
  enterDistanceY: 6,
  /** Subtle horizontal translation on enter (px) */
  enterDistanceX: 8,
  /** Subtle translation on exit (px) */
  exitDistanceY: -4,
  /** Stagger interval for child elements (seconds) */
  staggerStep: 0.03,
  /** Tactile button depression scale (never excessively shrunk) */
  pressedScale: 0.98,
  /** Opacity range */
  opacityHidden: 0,
  opacityVisible: 1,
} as const;

export const cssMotionTokens = {
  fast: '100ms',
  standard: '180ms',
  slow: '280ms',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/**
 * Strict Animation Ownership Definition
 * Exactly ONE engine owns a given property on any component.
 */
export type AnimationOwner = 'CSS' | 'GSAP' | 'Anime.js';

export interface MotionDeclaration {
  component: string;
  property: string;
  owner: AnimationOwner;
  duration: number;
  easing: string;
  rationale: string;
}
