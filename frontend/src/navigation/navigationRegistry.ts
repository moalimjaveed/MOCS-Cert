/**
 * MOCS-Cert Canonical Navigation Registry
 * Single authoritative source of truth for navigation domains, destinations,
 * routes, observable configurations, and workspace views.
 *
 * Information Architecture Hierarchy:
 * - Sidebar = Domain Map
 * - Page = Object / Workspace
 * - Tabs = Contextual Views of that Object
 * - URL = Single Authoritative Source of Truth
 */

export type NavSectionKey =
  | 'project'
  | 'dataset'
  | 'observables'
  | 'index'
  | 'verification'
  | 'benchmarks'
  | 'workflows'
  | 'help';

export interface NavDestination {
  id: string;
  section: NavSectionKey;
  label: string;
  testId: string;
  ariaLabel: string;
  canonicalRoute: string;
  isDatasetRow?: boolean;
  isModalTrigger?: boolean;
}

export interface NavSection {
  key: NavSectionKey;
  label: string;
  testId: string;
  items: NavDestination[];
}

export interface ObservableConfig {
  id: 'distance' | 'contact' | 'hbond';
  label: string;
  operator: string;
  queryText: string;
  selectionA: string;
  selectionB: string;
  defaultBlockId: number;
  selectionContext: string;
}

export const OBSERVABLE_CONFIGS: Record<string, ObservableConfig> = {
  distance: {
    id: 'distance',
    label: 'Distance',
    operator: 'DISTANCE-v1',
    queryText: 'FIND DISTANCE(A:155:CA, LIG:1:O2) < 4.0 Å',
    selectionA: 'A:155:CA',
    selectionB: 'LIG:1:O2',
    defaultBlockId: 41,
    selectionContext: 'A:155:CA ↔ LIG:1:O2',
  },
  contact: {
    id: 'contact',
    label: 'Contact',
    operator: 'CONTACT-v1',
    queryText: 'FIND CONTACT(PHE89, LIG) < 4.5 Å',
    selectionA: 'PHE89',
    selectionB: 'LIG',
    defaultBlockId: 85,
    selectionContext: 'PHE89 ↔ LIG',
  },
  hbond: {
    id: 'hbond',
    label: 'Hydrogen Bond',
    operator: 'HBOND-v1',
    queryText: 'FIND HBOND(TYR151:OH, LIG:1:O2)',
    selectionA: 'TYR151:OH',
    selectionB: 'LIG:1:O2',
    defaultBlockId: 25,
    selectionContext: 'TYR151:OH ↔ LIG:1:O2',
  },
};

export const WORKSPACE_TAB_KEYS = [
  'Workstation',
  'Molecular View',
  'Index Catalog',
  'Refinement Explorer',
  'Execution Benchmarks',
  'Formal Audit',
] as const;

export type WorkspaceTabKey = (typeof WORKSPACE_TAB_KEYS)[number];

export const WORKSPACE_TAB_SLUGS: Record<WorkspaceTabKey, string> = {
  'Workstation': 'workstation',
  'Molecular View': 'molecular',
  'Index Catalog': 'index',
  'Refinement Explorer': 'refinement',
  'Execution Benchmarks': 'benchmarks',
  'Formal Audit': 'audit',
};

export const SLUG_TO_WORKSPACE_TAB: Record<string, WorkspaceTabKey> = {
  workstation: 'Workstation',
  molecular: 'Molecular View',
  index: 'Index Catalog',
  refinement: 'Refinement Explorer',
  benchmarks: 'Execution Benchmarks',
  audit: 'Formal Audit',
  'formal-audit': 'Formal Audit',
};

export const CANONICAL_NAVIGATION_SECTIONS: NavSection[] = [
  {
    key: 'project',
    label: 'Project',
    testId: 'nav-group-project',
    items: [
      {
        id: 'experiment',
        section: 'project',
        label: 'Experiment',
        testId: 'nav-item-experiment',
        ariaLabel: 'Experiment Overview',
        canonicalRoute: '/experiments/synth_500f',
      },
    ],
  },
  {
    key: 'dataset',
    label: 'Dataset',
    testId: 'nav-group-dataset',
    items: [
      {
        id: 'dataset',
        section: 'dataset',
        label: 'Dataset',
        testId: 'nav-item-dataset',
        ariaLabel: 'Dataset Resources',
        canonicalRoute: '/dataset',
        isDatasetRow: true,
      },
    ],
  },
  {
    key: 'observables',
    label: 'Analysis',
    testId: 'nav-group-observables',
    items: [
      {
        id: 'distance',
        section: 'observables',
        label: 'Distance',
        testId: 'nav-item-distance',
        ariaLabel: 'Distance Observable',
        canonicalRoute: '/observables/distance',
      },
      {
        id: 'contact',
        section: 'observables',
        label: 'Contact',
        testId: 'nav-item-contact',
        ariaLabel: 'Contact Observable',
        canonicalRoute: '/observables/contact',
      },
      {
        id: 'hbond',
        section: 'observables',
        label: 'Hydrogen Bond',
        testId: 'nav-item-hbond',
        ariaLabel: 'Hydrogen Bond Observable',
        canonicalRoute: '/observables/hbond',
      },
    ],
  },
  {
    key: 'index',
    label: 'Index',
    testId: 'nav-group-index',
    items: [
      {
        id: 'index',
        section: 'index',
        label: 'Index',
        testId: 'nav-item-index',
        ariaLabel: 'Index Catalog',
        canonicalRoute: '/index',
      },
    ],
  },
  {
    key: 'verification',
    label: 'Verification',
    testId: 'nav-group-verification',
    items: [
      {
        id: 'verification',
        section: 'verification',
        label: 'Verification',
        testId: 'nav-item-verification',
        ariaLabel: 'Formal Verification Suite',
        canonicalRoute: '/verification',
      },
    ],
  },
  {
    key: 'benchmarks',
    label: 'Benchmarks',
    testId: 'nav-group-benchmarks',
    items: [
      {
        id: 'benchmarks',
        section: 'benchmarks',
        label: 'Benchmarks',
        testId: 'nav-item-benchmarks',
        ariaLabel: 'Execution Benchmarks',
        canonicalRoute: '/benchmarks',
      },
    ],
  },
  {
    key: 'workflows',
    label: 'Workflows',
    testId: 'nav-group-workflows',
    items: [
      {
        id: 'workflows',
        section: 'workflows',
        label: 'Workflows',
        testId: 'nav-item-workflows',
        ariaLabel: 'Scientific Workflows',
        canonicalRoute: '/workflows',
      },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    testId: 'nav-group-help',
    items: [
      {
        id: 'docs',
        section: 'help',
        label: 'Documentation',
        testId: 'nav-item-docs',
        ariaLabel: 'Documentation Reference',
        canonicalRoute: '#docs',
        isModalTrigger: true,
      },
    ],
  },
];
