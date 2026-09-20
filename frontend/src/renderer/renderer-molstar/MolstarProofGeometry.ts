import { LinesBuilder } from 'molstar/lib/mol-geo/geometry/lines/lines-builder.js';
import { Lines } from 'molstar/lib/mol-geo/geometry/lines/lines.js';
import { MeshBuilder } from 'molstar/lib/mol-geo/geometry/mesh/mesh-builder.js';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh.js';
import { addSphere } from 'molstar/lib/mol-geo/geometry/mesh/builder/sphere.js';
import { Shape } from 'molstar/lib/mol-model/shape.js';
import { Color } from 'molstar/lib/mol-util/color/index.js';
import { ScientificAABB, MeasurementCaliper } from '@mocs/geometry';
import { AABBStyle } from '@mocs/scene';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra.js';

export function buildAABBLines(aabb: ScientificAABB, style: AABBStyle): Lines {
  const [x0, y0, z0] = aabb.min;
  const [x1, y1, z1] = aabb.max;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const minDim = Math.min(dx, dy, dz);
  const bracketLen = Math.max(1.0, Math.min(3.0, minDim * 0.25));

  const builder = LinesBuilder.create(64, 32);

  // Helper to add a 3D line segment
  const addSegment = (xa: number, ya: number, za: number, xb: number, yb: number, zb: number) => {
    builder.add(xa, ya, za, xb, yb, zb, 0);
  };

  // Helper to add 12 full wireframe edges
  const addFullWireframe = () => {
    // Bottom 4
    addSegment(x0, y0, z0, x1, y0, z0);
    addSegment(x1, y0, z0, x1, y1, z0);
    addSegment(x1, y1, z0, x0, y1, z0);
    addSegment(x0, y1, z0, x0, y0, z0);
    // Top 4
    addSegment(x0, y0, z1, x1, y0, z1);
    addSegment(x1, y0, z1, x1, y1, z1);
    addSegment(x1, y1, z1, x0, y1, z1);
    addSegment(x0, y1, z1, x0, y0, z1);
    // Vertical 4
    addSegment(x0, y0, z0, x0, y0, z1);
    addSegment(x1, y0, z0, x1, y0, z1);
    addSegment(x1, y1, z0, x1, y1, z1);
    addSegment(x0, y1, z0, x0, y1, z1);
  };

  // Helper to add 8 corner brackets
  const addCornerBrackets = (len: number) => {
    // Corner 000
    addSegment(x0, y0, z0, x0 + len, y0, z0);
    addSegment(x0, y0, z0, x0, y0 + len, z0);
    addSegment(x0, y0, z0, x0, y0, z0 + len);
    // Corner 100
    addSegment(x1, y0, z0, x1 - len, y0, z0);
    addSegment(x1, y0, z0, x1, y0 + len, z0);
    addSegment(x1, y0, z0, x1, y0, z0 + len);
    // Corner 110
    addSegment(x1, y1, z0, x1 - len, y1, z0);
    addSegment(x1, y1, z0, x1, y1 - len, z0);
    addSegment(x1, y1, z0, x1, y1, z0 + len);
    // Corner 010
    addSegment(x0, y1, z0, x0 + len, y1, z0);
    addSegment(x0, y1, z0, x0, y1 - len, z0);
    addSegment(x0, y1, z0, x0, y1, z0 + len);

    // Corner 001
    addSegment(x0, y0, z1, x0 + len, y0, z1);
    addSegment(x0, y0, z1, x0, y0 + len, z1);
    addSegment(x0, y0, z1, x0, y0, z1 - len);
    // Corner 101
    addSegment(x1, y0, z1, x1 - len, y0, z1);
    addSegment(x1, y0, z1, x1, y0 + len, z1);
    addSegment(x1, y0, z1, x1, y0, z1 - len);
    // Corner 111
    addSegment(x1, y1, z1, x1 - len, y1, z1);
    addSegment(x1, y1, z1, x1, y1 - len, z1);
    addSegment(x1, y1, z1, x1, y1, z1 - len);
    // Corner 011
    addSegment(x0, y1, z1, x0 + len, y1, z1);
    addSegment(x0, y1, z1, x0, y1 - len, z1);
    addSegment(x0, y1, z1, x0, y1, z1 - len);
  };

  if (style === 'wireframe') {
    addFullWireframe();
  } else if (style === 'corners') {
    addCornerBrackets(bracketLen);
  } else {
    // Hybrid: wireframe + corner brackets
    addFullWireframe();
    addCornerBrackets(bracketLen);
  }

  return builder.getLines();
}

export function createAABBShape(aabb: ScientificAABB, style: AABBStyle, colorHex: number, label: string): Shape<Lines> {
  const lines = buildAABBLines(aabb, style);
  const color = Color(colorHex);
  return Shape.create(
    label,
    { aabb, style },
    lines,
    () => color,
    () => 1,
    () => label
  );
}

export function buildCaliperLines(caliper: MeasurementCaliper): Lines {
  const builder = LinesBuilder.create(16, 8);
  const [x0, y0, z0] = caliper.pointA;
  const [x1, y1, z1] = caliper.pointB;

  // Main distance segment
  builder.add(x0, y0, z0, x1, y1, z1, 0);

  // Perpendicular end ticks for unambiguous caliper termination
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len > 1e-4) {
    let px = -dy;
    let py = dx;
    let pz = 0;
    let pLen = Math.sqrt(px * px + py * py);
    if (pLen < 1e-4) {
      px = 0;
      py = -dz;
      pz = dy;
      pLen = Math.sqrt(py * py + pz * pz);
    }
    const tickLen = 0.20; // 0.20 Å subtle scientific cross-tick
    const nx = (px / pLen) * tickLen;
    const ny = (py / pLen) * tickLen;
    const nz = (pz / pLen) * tickLen;

    // Cross tick at endpoint A
    builder.add(x0 - nx, y0 - ny, z0 - nz, x0 + nx, y0 + ny, z0 + nz, 0);
    // Cross tick at endpoint B
    builder.add(x1 - nx, y1 - ny, z1 - nz, x1 + nx, y1 + ny, z1 + nz, 0);
  }

  return builder.getLines();
}

export function createCaliperShape(caliper: MeasurementCaliper, colorHex: number, label: string): Shape<Lines> {
  const lines = buildCaliperLines(caliper);
  const color = Color(colorHex);
  return Shape.create(
    label,
    { caliper },
    lines,
    () => color,
    () => 1,
    () => `${label} (${caliper.distanceAngstroms.toFixed(2)} Å)`
  );
}

export function buildReticleMesh(position: readonly [number, number, number], radius = 0.22): Mesh {
  const state = MeshBuilder.createState(64, 32);
  state.currentGroup = 0;
  const center = Vec3.create(position[0], position[1], position[2]);
  addSphere(state, center, radius, 2);
  return MeshBuilder.getMesh(state);
}

export function createReticleShape(position: readonly [number, number, number], colorHex: number, label: string): Shape<Mesh> {
  const mesh = buildReticleMesh(position, 0.22);
  const color = Color(colorHex);
  return Shape.create(
    label,
    { position },
    mesh,
    () => color,
    () => 1,
    () => label
  );
}
