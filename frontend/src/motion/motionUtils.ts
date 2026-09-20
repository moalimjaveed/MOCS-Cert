import gsap from 'gsap';
import { animate } from 'animejs';
import { motionDurations, motionEasings, motionSpatial, MotionDeclaration } from './motionTokens';

/**
 * Official Animation Registry for MOCS-Cert
 * Records ownership, property targets, durations, and accessibility rationale.
 */
export const MOTION_REGISTRY: MotionDeclaration[] = [
  {
    component: 'LeftSidebar',
    property: 'width, opacity, translateX',
    owner: 'GSAP',
    duration: motionDurations.standard,
    easing: motionEasings.easeOut,
    rationale: 'Physical rail transformation without layout jitter or text popping',
  },
  {
    component: 'RightInspector',
    property: 'translateX, opacity',
    owner: 'GSAP',
    duration: motionDurations.standard,
    easing: motionEasings.easeOut,
    rationale: 'Smooth drawer entry/exit without unmount flash',
  },
  {
    component: 'WorkspaceNavBar',
    property: 'opacity, translateY',
    owner: 'GSAP',
    duration: motionDurations.standard,
    easing: motionEasings.easeOut,
    rationale: 'Instrument workspace mode transitions with zero page reload jump',
  },
  {
    component: 'DyadicZoomLattice',
    property: 'opacity, translateY, strokeDashoffset',
    owner: 'GSAP',
    duration: motionDurations.standard,
    easing: motionEasings.easeOut,
    rationale: 'Subdivision causality from parent bounding envelope to child sub-blocks',
  },
  {
    component: 'CertificateVerificationLoader',
    property: 'scale, opacity, strokeDasharray',
    owner: 'Anime.js',
    duration: motionDurations.slow,
    easing: 'easeOutQuad',
    rationale: 'Specialized cryptographic verification pulse & shield highlight',
  },
  {
    component: 'AppBootLoader',
    property: 'opacity, translateY',
    owner: 'GSAP',
    duration: motionDurations.slow,
    easing: motionEasings.easeEmphasis,
    rationale: 'Precision application bootstrap revealing actual stages as data arrives',
  },
  {
    component: 'DatasetLoader',
    property: 'opacity',
    owner: 'GSAP',
    duration: motionDurations.standard,
    easing: motionEasings.easeOut,
    rationale: 'Invalidation crossfade on data swap while keeping workstation shell stable',
  },
];

/**
 * Standard slide + fade entry tween helper
 */
export function createSlideFadeEnter(
  target: gsap.TweenTarget,
  isReduced: boolean = false,
  overrides: gsap.TweenVars = {}
): gsap.core.Tween {
  if (isReduced) {
    return gsap.to(target, {
      opacity: 1,
      duration: 0.01,
      ...overrides,
    });
  }

  return gsap.fromTo(
    target,
    {
      opacity: 0,
      y: motionSpatial.enterDistanceY,
    },
    {
      opacity: 1,
      y: 0,
      duration: motionDurations.standard,
      ease: motionEasings.easeOut,
      ...overrides,
    }
  );
}

/**
 * Standard staggered entry for cards or list items
 */
export function createStaggerEnter(
  targets: gsap.TweenTarget,
  isReduced: boolean = false,
  overrides: gsap.TweenVars = {}
): gsap.core.Tween {
  if (isReduced) {
    return gsap.to(targets, {
      opacity: 1,
      duration: 0.01,
      ...overrides,
    });
  }

  return gsap.fromTo(
    targets,
    {
      opacity: 0,
      y: motionSpatial.enterDistanceY,
    },
    {
      opacity: 1,
      y: 0,
      duration: motionDurations.standard,
      stagger: motionSpatial.staggerStep,
      ease: motionEasings.easeOut,
      ...overrides,
    }
  );
}

/**
 * Specialized Anime.js verification pulse for badges / shield icons
 */
export function triggerVerificationPulse(element: HTMLElement | null): void {
  if (!element) return;
  try {
    if (typeof animate === 'function') {
      animate(element, {
        scale: [1, 1.04, 1],
        opacity: [0.85, 1, 1],
        duration: 320,
        ease: 'outQuad',
      });
    }
  } catch (_err) {
    // Graceful fallback for headless / jsdom environments
  }
}
