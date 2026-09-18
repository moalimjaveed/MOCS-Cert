/**
 * MOCS Mathematical Protein Intelligence — Physical Dynamics / Hydrodynamic Module
 * 
 * Epistemic Status: EXPERIMENTAL
 * Label: "Hydrodynamic Research Model"
 * 
 * Computes continuum fluid dynamics approximations and Stokes-Einstein diffusion
 * parameters for biopolymers in aqueous solutions.
 * 
 * Scientific Disclaimer:
 * This module is an exploratory hydrodynamic research model and does NOT imply
 * that Navier-Stokes equations predict protein folding dynamics independently.
 */

import type { HydrodynamicsMetrics } from './types';
import { computeRadiusOfGyration, type CartesianAtom } from './geometryEngine';

// Physical Constants
const BOLTZMANN_K = 1.380649e-23; // J/K
const WATER_VISCOSITY_PA_S = 0.89e-3; // Pa·s at 298.15 K (0.89 cP)
const TEMPERATURE_KELVIN = 298.15; // 25 °C

/**
 * Calculates raw Stokes-Einstein diffusion coefficient and hydrodynamic radius.
 */
export function calculateStokesEinsteinDiffusion(
  radiusOfGyration: number,
  temperatureKelvin: number = TEMPERATURE_KELVIN,
  viscosityPaS: number = WATER_VISCOSITY_PA_S
): {
  status: 'EXPERIMENTAL';
  diffusionCoefficient_m2_per_s: number;
  hydrodynamicRadius_A: number;
  temperature_K: number;
  solventViscosity_Pa_s: number;
} {
  const Rg = Math.max(0.5, radiusOfGyration);
  const Rh_angstrom = Number((0.774 * Rg).toFixed(2));
  const Rh_meters = Rh_angstrom * 1e-10;

  const denominator = 6 * Math.PI * viscosityPaS * Rh_meters;
  const D_m2_s = denominator > 0 ? (BOLTZMANN_K * temperatureKelvin) / denominator : 0;

  return {
    status: 'EXPERIMENTAL',
    diffusionCoefficient_m2_per_s: D_m2_s,
    hydrodynamicRadius_A: Rh_angstrom,
    temperature_K: temperatureKelvin,
    solventViscosity_Pa_s: viscosityPaS,
  };
}

/**
 * Computes hydrodynamic diffusion parameters based on the Stokes-Einstein relation:
 * D = (k_B * T) / (6 * pi * eta * R_h)
 * where R_h ≈ 0.77 * R_g for typical globular proteins.
 */
export function analyzeHydrodynamics(radiusOfGyration: number): HydrodynamicsMetrics {
  const diff = calculateStokesEinsteinDiffusion(radiusOfGyration);
  // In units of 10^-7 cm²/s (1 m²/s = 10^4 cm²/s -> D_m2_s * 10^4 / 10^-7 = D_m2_s * 10^11)
  const D_units = Number((diff.diffusionCoefficient_m2_per_s * 1e11).toFixed(2));

  return {
    status: 'EXPERIMENTAL',
    label: 'Hydrodynamic Research Model',
    solvent: 'Water (Aqueous)',
    temperatureKelvin: diff.temperature_K,
    viscosityCentipoise: 0.89,
    effectiveHydrodynamicRadius: diff.hydrodynamicRadius_A,
    stokesEinsteinDiffusionCoeff: D_units,
    estimatedShearRateSec: 1250,
    reynoldsNumberMicroscopic: 1.45e-5,
  };
}

/**
 * Comprehensive Hydrodynamics metrics bundle for atoms or Rg.
 */
export function calculateHydrodynamicsMetrics(
  input: number | Array<CartesianAtom | [number, number, number]>,
  temperatureKelvin: number = TEMPERATURE_KELVIN
) {
  const rg = typeof input === 'number' ? input : computeRadiusOfGyration(input);
  const metrics = analyzeHydrodynamics(rg);
  const stokesEinstein = calculateStokesEinsteinDiffusion(rg, temperatureKelvin);

  return {
    ...metrics,
    stokesEinstein,
  };
}
