import { describe, it, expect } from 'vitest';
import { buildAABBLines, buildCaliperLines } from '@mocs/renderer-molstar';
import { ScientificAABB, MeasurementCaliper, createMeasurementCaliper } from '@mocs/geometry';
import { jcsSerialize, sha256Hex, serializeCoordinates } from '@mocs/evidence';
import { SceneRevisionManager } from '@mocs/scene';

export interface BenchmarkGeometryResult {
  count: number;
  linesVertexCount: number;
  linesTriangleCount: number;
  linesBufferBytes: number;
  linesGenTimeMs: number;
  cylinderVertexCount: number;
  cylinderTriangleCount: number;
  cylinderBufferBytes: number;
  meshTessellationEstimateMs: number;
}

export interface TrajectoryUpdateResult {
  frameCount: number;
  totalTimeMs: number;
  avgTimePerFrameMs: number;
  fpsCapability: number;
}

function createDummyAABB(id: number): ScientificAABB {
  const offset = id * 15;
  return {
    min: [offset, offset, offset],
    max: [offset + 10, offset + 12, offset + 14],
    center: [offset + 5, offset + 6, offset + 7],
    size: [10, 12, 14],
    atomCount: 150,
    frameIdentity: 0,
    componentIdentity: 'protein',
    spatialIdentity: `auth-${id}`,
  };
}

function createDummyCaliper(id: number): MeasurementCaliper {
  const offset = id * 15;
  return createMeasurementCaliper(
    `caliper-${id}`,
    'A:87:NE2',
    'HEM:142:FE',
    [offset, offset, offset],
    [offset + 2.06, offset, offset]
  );
}

describe('Section 14 & 15: Performance Benchmark Suite & Empirical Measurements', () => {
  it('measures geometry scaling across 1, 10, 50, and 100 AABBs (LinesBuilder vs Cylinder Mesh)', () => {
    const counts = [1, 10, 50, 100];
    const results: BenchmarkGeometryResult[] = [];

    for (const count of counts) {
      const aabbs = Array.from({ length: count }, (_, i) => createDummyAABB(i));

      // Measure LinesBuilder execution
      const t0 = performance.now();
      let totalLineSegments = 0;
      for (const aabb of aabbs) {
        const lines = buildAABBLines(aabb, 'wireframe');
        totalLineSegments += lines.lineCount;
      }
      const linesGenTimeMs = performance.now() - t0;

      // LinesBuilder metrics: 12 segments = 24 vertices per AABB, 0 triangles
      const linesVertexCount = totalLineSegments * 2;
      const linesTriangleCount = 0;
      // 3 float32 coordinates (12 bytes) per vertex
      const linesBufferBytes = linesVertexCount * 12;

      // Comparative cylinder mesh metrics (standard 16-radial-segment closed cylinders):
      // Each cylinder has 66 vertices (32 tube + 34 caps) and 64 triangles
      // 12 cylinders per AABB: 12 * 66 = 792 vertices, 12 * 64 = 768 triangles
      const cylinderVertexCount = count * 12 * 66;
      const cylinderTriangleCount = count * 12 * 64;
      // Position buffer (12 bytes/vert) + index buffer (6 bytes/tri) + normal buffer (12 bytes/vert)
      const cylinderBufferBytes = (cylinderVertexCount * 24) + (cylinderTriangleCount * 6);
      // Theoretical tessellation overhead estimate (~0.045 ms per volumetric cylinder)
      const meshTessellationEstimateMs = count * 12 * 0.045;

      results.push({
        count,
        linesVertexCount,
        linesTriangleCount,
        linesBufferBytes,
        linesGenTimeMs: Number(linesGenTimeMs.toFixed(3)),
        cylinderVertexCount,
        cylinderTriangleCount,
        cylinderBufferBytes,
        meshTessellationEstimateMs: Number(meshTessellationEstimateMs.toFixed(2)),
      });

      // Assertions
      expect(totalLineSegments).toBe(count * 12);
      expect(linesVertexCount).toBe(count * 24);
      expect(linesTriangleCount).toBe(0);
      // LinesBuilder must produce exactly 0 triangles for wireframes
      expect(linesBufferBytes).toBeLessThan(cylinderBufferBytes / 10);
    }

    // Output formatted benchmark table
    console.log('\n=================== GEOMETRY SCALING BENCHMARK (LINES VS CYLINDERS) ===================');
    console.table(results.map(r => ({
      'AABB Count': r.count,
      'Lines Verts': r.linesVertexCount,
      'Lines Tris': r.linesTriangleCount,
      'Lines Memory (KB)': (r.linesBufferBytes / 1024).toFixed(2),
      'Lines Time (ms)': r.linesGenTimeMs,
      'Cylinder Verts': r.cylinderVertexCount,
      'Cylinder Tris': r.cylinderTriangleCount,
      'Cylinder Memory (KB)': (r.cylinderBufferBytes / 1024).toFixed(2),
      'Cylinder Overhead (ms)': r.meshTessellationEstimateMs,
    })));
  });

  it('measures dynamic trajectory playback updates across 100 frames', () => {
    const frameCount = 100;
    const aabb = createDummyAABB(0);

    const t0 = performance.now();
    for (let frame = 0; frame < frameCount; frame++) {
      // Simulate dynamic coordinate shift (e.g. molecular fluctuation ±0.1 Å)
      const delta = Math.sin(frame * 0.1) * 0.5;
      const dynamicAabb: ScientificAABB = {
        ...aabb,
        min: [aabb.min[0] + delta, aabb.min[1], aabb.min[2]],
        max: [aabb.max[0] + delta, aabb.max[1], aabb.max[2]],
        frameIdentity: frame,
      };
      // Direct endpoint / line update
      const lines = buildAABBLines(dynamicAabb, 'wireframe');
      expect(lines.lineCount).toBe(12);
    }
    const totalTimeMs = performance.now() - t0;
    const avgTimePerFrameMs = totalTimeMs / frameCount;
    const fpsCapability = 1000 / avgTimePerFrameMs;

    console.log('\n=================== TRAJECTORY FRAME UPDATE BENCHMARK ===================');
    console.log(`Frames processed:      ${frameCount}`);
    console.log(`Total CPU Time:        ${totalTimeMs.toFixed(3)} ms`);
    console.log(`Avg Time Per Frame:    ${avgTimePerFrameMs.toFixed(4)} ms`);
    console.log(`Theoretical Max FPS:   ${fpsCapability.toFixed(1)} FPS`);

    // Invariant: direct line buffer update must be < 1.0 ms per frame (capable of well beyond 60 FPS)
    expect(avgTimePerFrameMs).toBeLessThan(1.0);
    expect(fpsCapability).toBeGreaterThan(60);
  });

  it('measures annotation combinations scaling (AABB + Caliper + Reticles)', () => {
    const t0 = performance.now();
    const iterations = 500;

    for (let i = 0; i < iterations; i++) {
      // 1. Protein AABB
      const aabb1 = createDummyAABB(1);
      const linesAabb1 = buildAABBLines(aabb1, 'wireframe');

      // 2. Ligand AABB
      const aabb2 = createDummyAABB(2);
      const linesAabb2 = buildAABBLines(aabb2, 'wireframe');

      // 3. Distance Caliper
      const caliper = createDummyCaliper(1);
      const linesCaliper = buildCaliperLines(caliper);

      expect(linesAabb1.lineCount).toBe(12);
      expect(linesAabb2.lineCount).toBe(12);
      // Caliper: 1 main line + 2 cross ticks = 3 line segments
      expect(linesCaliper.lineCount).toBe(3);
    }

    const totalMs = performance.now() - t0;
    const avgMs = totalMs / iterations;

    console.log('\n=================== ANNOTATION COMBINATIONS BENCHMARK ===================');
    console.log(`Composite scenes:      ${iterations}`);
    console.log(`Total CPU Time:        ${totalMs.toFixed(3)} ms`);
    console.log(`Avg Per Scene:         ${avgMs.toFixed(4)} ms`);

    expect(avgMs).toBeLessThan(0.2); // Less than 0.2ms per complete composite scene
  });

  it('measures RFC 8785 Canonical Hashing and Binary Coordinate Digest throughput', async () => {
    const coords = new Float64Array(3000); // 1,000 3D atoms
    for (let i = 0; i < coords.length; i++) {
      coords[i] = (i * 0.12345) % 50.0;
    }

    const t0 = performance.now();
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      // 1. Little-endian coordinate serialization
      const bin = serializeCoordinates(coords);
      // 2. Binary digest
      await sha256Hex(bin);

      // 3. RFC 8785 JCS payload serialization
      const payload = {
        dataset: '4HHB',
        frame: i,
        model: 1,
        proofCount: 3,
        timestamp: 1718000000000 + i,
      };
      const jcs = jcsSerialize(payload);
      await sha256Hex(jcs);
    }

    const totalMs = performance.now() - t0;
    const avgMs = totalMs / iterations;

    console.log('\n=================== EVIDENCE CANONICAL HASHING BENCHMARK ===================');
    console.log(`Iterations (1,000 atoms): ${iterations}`);
    console.log(`Total Time:               ${totalMs.toFixed(3)} ms`);
    console.log(`Avg Hash Time:            ${avgMs.toFixed(4)} ms`);

    expect(avgMs).toBeLessThan(5.0);
  });
});
