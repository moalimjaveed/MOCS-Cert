/**
 * MOCS-Cert Canonical Design System Primitives
 *
 * Import from this barrel when using any canonical primitive.
 *
 * All primitives enforce:
 * - Segoe UI Variable typography (inherits from body)
 * - Canonical radius scale (rounded-[4px] for controls, rounded-[6px] for surfaces)
 * - Solid semantic fill colors (no pale tints, no glassmorphism)
 * - Accessible ARIA semantics
 * - WCAG AA contrast
 */

export { MocsButton } from './MocsButton';
export type { MocsButtonProps, MocsButtonVariant, MocsButtonSize } from './MocsButton';

export { MocsIconButton } from './MocsIconButton';
export type { MocsIconButtonProps } from './MocsIconButton';

export { MocsBadge, truthValueToVariant } from './MocsBadge';
export type { MocsBadgeProps, MocsBadgeVariant, MocsBadgeSize } from './MocsBadge';

export { MocsTabs } from './MocsTabs';
export type { MocsTabsProps, MocsTab } from './MocsTabs';

export { MocsSection } from './MocsSection';
export type { MocsSectionProps } from './MocsSection';

export { MocsInspectorRow } from './MocsInspectorRow';
export type { MocsInspectorRowProps, MocsInspectorRowHighlight } from './MocsInspectorRow';

export { MocsScientificValue } from './MocsScientificValue';
export type { MocsScientificValueProps } from './MocsScientificValue';

export { MocsTable } from './MocsTable';
export type { MocsTableProps } from './MocsTable';

export * from './SkeletonPrimitives';
