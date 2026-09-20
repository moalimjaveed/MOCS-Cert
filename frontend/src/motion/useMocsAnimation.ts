import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from './useReducedMotion';

// Register the useGSAP plugin with GSAP once
gsap.registerPlugin(useGSAP);

export interface MocsAnimationOptions {
  scope?: React.RefObject<any> | HTMLElement | null;
  dependencies?: any[];
  revertOnUpdate?: boolean;
}

/**
 * useMocsAnimation
 * Centralized GSAP animation hook with automatic lifecycle management,
 * reduced-motion compliance, and deterministic cleanup.
 */
export function useMocsAnimation(
  callback: (ctx: gsap.Context, isReduced: boolean) => void,
  options: MocsAnimationOptions = {}
) {
  const isReduced = useReducedMotion();
  const { scope, dependencies = [], revertOnUpdate = true } = options;

  const resolvedScope =
    scope && typeof scope === 'object' && 'current' in scope
      ? scope.current ?? undefined
      : scope ?? undefined;

  useGSAP(
    (context) => {
      callback(context, isReduced);
    },
    {
      scope: resolvedScope as any,
      dependencies: [...dependencies, isReduced],
      revertOnUpdate,
    }
  );
}

export { gsap };
