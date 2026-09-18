/**
 * MOCS-Cert Molecular Surfaces — 3D Uniform Spatial Hash Grid
 * 
 * Epistemic Status: ESTABLISHED
 * Algorithm: Cell-List Spatial Partitioning for O(1) Amortized Neighbor Search
 * 
 * Eliminates O(N²) all-pairs distance calculations while preserving exact
 * Euclidean geometric precision with strict squared-distance comparisons.
 */

export interface IndexedSpatialPoint {
  index: number;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export class SpatialGrid {
  private cellSize: number;
  private invCellSize: number;
  private cells = new Map<string, number[]>();
  private points: IndexedSpatialPoint[] = [];

  constructor(points: Array<{ coordinates: [number, number, number]; radius?: number }>, cellSize = 4.0) {
    this.cellSize = Math.max(0.5, cellSize);
    this.invCellSize = 1.0 / this.cellSize;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const pt: IndexedSpatialPoint = {
        index: i,
        x: p.coordinates[0],
        y: p.coordinates[1],
        z: p.coordinates[2],
        radius: p.radius ?? 0,
      };
      this.points.push(pt);

      const cellKey = this.hashCoords(pt.x, pt.y, pt.z);
      let list = this.cells.get(cellKey);
      if (!list) {
        list = [];
        this.cells.set(cellKey, list);
      }
      list.push(i);
    }
  }

  private hashCoords(x: number, y: number, z: number): string {
    const cx = Math.floor(x * this.invCellSize);
    const cy = Math.floor(y * this.invCellSize);
    const cz = Math.floor(z * this.invCellSize);
    return `${cx},${cy},${cz}`;
  }

  /**
   * Returns all atom indices within distance `radius` of the target coordinate.
   * Compares squared distances to avoid unnecessary square root operations.
   */
  public queryRadius(
    x: number,
    y: number,
    z: number,
    radius: number,
    excludeIndex: number = -1
  ): number[] {
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCy = Math.floor((y - radius) * this.invCellSize);
    const maxCy = Math.floor((y + radius) * this.invCellSize);
    const minCz = Math.floor((z - radius) * this.invCellSize);
    const maxCz = Math.floor((z + radius) * this.invCellSize);

    const neighbors: number[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const key = `${cx},${cy},${cz}`;
          const cellIndices = this.cells.get(key);
          if (!cellIndices) continue;

          for (let k = 0; k < cellIndices.length; k++) {
            const idx = cellIndices[k];
            if (idx === excludeIndex) continue;

            const pt = this.points[idx];
            const dx = pt.x - x;
            const dy = pt.y - y;
            const dz = pt.z - z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq <= r2) {
              neighbors.push(idx);
            }
          }
        }
      }
    }

    return neighbors;
  }

  /**
   * Fast occlusion test for a sphere point against all neighboring expanded spheres.
   */
  public isPointOccludedByNeighbors(
    px: number,
    py: number,
    pz: number,
    neighborIndices: number[],
    expandedRadii: number[]
  ): boolean {
    for (let i = 0; i < neighborIndices.length; i++) {
      const idx = neighborIndices[i];
      const pt = this.points[idx];
      const rExp = expandedRadii[idx];
      const rExpSq = rExp * rExp;

      const dx = pt.x - px;
      const dy = pt.y - py;
      const dz = pt.z - pz;
      const d2 = dx * dx + dy * dy + dz * dz;

      // If point is strictly inside neighbor's expanded sphere, it is solvent-inaccessible (occluded)
      if (d2 < rExpSq) {
        return true;
      }
    }
    return false;
  }

  public getPoint(index: number): IndexedSpatialPoint | undefined {
    return this.points[index];
  }

  public get count(): number {
    return this.points.length;
  }
}
