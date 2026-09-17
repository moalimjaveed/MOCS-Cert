export type SemanticColorTheme =
  | 'chain-muted'
  | 'chain-distinct'
  | 'element'
  | 'residue-type'
  | 'secondary-structure'
  | 'molecule'
  | 'selection'
  | 'proof';

/**
 * Restrained scientific color palette (hex numbers and CSS strings).
 */
export const SCIENTIFIC_PALETTES = {
  chains: {
    // Restrained tonal blue/cyan/slate values
    A: 0x3b82f6, // Slate Blue
    B: 0x06b6d4, // Cyan
    C: 0x6366f1, // Indigo
    D: 0x14b8a6, // Teal
    fallback: 0x64748b, // Neutral slate
  },
  ligand: {
    accent: 0xf59e0b, // Warm Amber
    heme: 0xd97706, // Deep Amber
  },
  proof: {
    proteinAabb: 0x38bdf8, // Electric Evidence Blue
    ligandAabb: 0xc084fc, // Violet Evidence
    caliper: 0x10b981, // Emerald Alert
    reticle: 0xfbbf24, // Pinpoint Reticle Amber
  },
  elements: {
    C: 0x94a3b8, // Slate
    N: 0x3b82f6, // Blue
    O: 0xef4444, // Red
    S: 0xeab308, // Yellow
    Fe: 0xd97706, // Rust Iron
    H: 0xf1f5f9, // Light
  },
} as const;
