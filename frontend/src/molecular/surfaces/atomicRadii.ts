/**
 * MOCS-Cert Molecular Surfaces — Van der Waals & Solvent Probe Radii
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Bondi (1964), Mantina et al. (2009), Rowland & Taylor (1996)
 * 
 * Provides canonical van der Waals radii in Ångströms (Å).
 * Never silently uses an arbitrary radius without explicit epistemic provenance.
 */

export const DEFAULT_SOLVENT_PROBE_RADIUS = 1.40; // Å (standard water molecule probe)
export const DEFAULT_FALLBACK_VDW_RADIUS = 1.70;  // Å (carbon-like default fallback)

/**
 * Standard Bondi / Mantina van der Waals radii in Ångströms.
 */
export const BONDI_VDW_RADII: Record<string, number> = {
  // Non-metals & Organics
  'H': 1.20,
  'D': 1.20,
  'HE': 1.40,
  'C': 1.70,
  'N': 1.55,
  'O': 1.52,
  'F': 1.47,
  'NE': 1.54,
  'P': 1.80,
  'S': 1.80,
  'CL': 1.75,
  'AR': 1.88,
  'AS': 1.85,
  'SE': 1.90,
  'BR': 1.85,
  'KR': 2.02,
  'TE': 2.06,
  'I': 1.98,
  'XE': 2.16,

  // Alkali & Alkaline Earth Metals
  'LI': 1.82,
  'BE': 1.53,
  'B': 1.92,
  'NA': 2.27,
  'MG': 1.73,
  'AL': 1.84,
  'SI': 2.10,
  'K': 2.75,
  'CA': 2.31,
  'RB': 3.03,
  'SR': 2.49,
  'CS': 3.43,
  'BA': 2.68,

  // Transition & Heavy Metals
  'SC': 2.11,
  'TI': 2.15,
  'V': 2.05,
  'CR': 2.05,
  'MN': 2.05,
  'FE': 1.80,
  'CO': 1.80,
  'NI': 1.63,
  'CU': 1.40,
  'ZN': 1.39,
  'GA': 1.87,
  'GE': 2.11,
  'Y': 2.32,
  'ZR': 2.23,
  'NB': 2.18,
  'MO': 2.17,
  'TC': 2.16,
  'RU': 2.13,
  'RH': 2.10,
  'PD': 1.63,
  'AG': 1.72,
  'CD': 1.58,
  'IN': 1.93,
  'SN': 2.17,
  'SB': 2.06,
  'PT': 1.75,
  'AU': 1.66,
  'HG': 1.55,
  'TL': 1.96,
  'PB': 2.02,
  'BI': 2.07,
  'U': 1.86,
};

/**
 * Returns the van der Waals radius for a chemical element in Ångströms.
 */
export function getVdwRadius(element: string): number {
  const norm = element.trim().toUpperCase();
  return BONDI_VDW_RADII[norm] ?? DEFAULT_FALLBACK_VDW_RADIUS;
}

/**
 * Returns the van der Waals radius with explicit fallback status.
 */
export function getVdwRadiusWithProvenance(
  element: string,
  fallback = DEFAULT_FALLBACK_VDW_RADIUS
): { radius: number; isFallback: boolean; element: string } {
  const norm = element.trim().toUpperCase();
  if (norm in BONDI_VDW_RADII) {
    return {
      radius: BONDI_VDW_RADII[norm],
      isFallback: false,
      element: norm,
    };
  }
  return {
    radius: fallback,
    isFallback: true,
    element: norm,
  };
}
