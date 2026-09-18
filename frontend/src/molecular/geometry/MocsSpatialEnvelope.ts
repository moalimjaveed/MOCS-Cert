import * as THREE from 'three';
import type {
  SpatialEnvelopeOptions,
  BoxDimensions,
  BoxExtrema,
} from '../types';
import {
  computeBoxDimensions,
  computeBoxExtrema,
  createCornerBrackets,
  createCentroidCrosshair,
  createExtentAxes,
} from './coordinateBounds';

/**
 * Creates a high-dpi canvas text sprite for 3D overlay annotations.
 * Safe in both browser and headless/test environments.
 */
function createAnnotationSprite(
  lines: string[],
  color = '#0F172A',
  borderColor = '#CBD5E1',
  bgColor = '#FFFFFF'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = lines.length > 2 ? 64 : 44;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;

  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(3, 3, 234, canvas.height - 6, 4);
    } else {
      ctx.rect(3, 3, 234, canvas.height - 6);
    }
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (lines.length === 1) {
      ctx.font = 'bold 13px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(lines[0], 120, canvas.height / 2);
    } else if (lines.length === 2) {
      ctx.font = 'bold 12px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(lines[0], 120, 16);
      ctx.font = '11px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(lines[1], 120, 31);
    } else {
      ctx.font = 'bold 11px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(lines[0], 120, 14);
      ctx.font = '10.5px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(lines[1], 120, 31);
      ctx.font = '10px "Segoe UI Variable", "Segoe UI", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText(lines[2], 120, 48);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: true });
  const sprite = new THREE.Sprite(spriteMat);
  const heightRatio = lines.length > 2 ? 1.0 : 0.72;
  sprite.scale.set(3.6, heightRatio, 1);
  return sprite;
}

/**
 * MocsSpatialEnvelope:
 * 
 * Reusable Three.js scientific spatial-evidence visualization component.
 * 
 * An AABB in MOCS is mathematically an axis-aligned bounding box:
 *   [x_min, x_max] × [y_min, y_max] × [z_min, z_max]
 * 
 * Responsibilities:
 * - Encapsulates exact THREE.Box3 coordinates with zero mathematical padding
 * - Renders crisp 1px primary wireframe edges
 * - Renders 3-axis orthogonal corner brackets (24 line segments)
 * - Renders restrained translucent volume faces (opacity ~0.05, depthWrite: false)
 * - Renders subtle AABB centroid marker ((min + max)/2, labeled "AABB center")
 * - Renders miniature local extent axes (X, Y, Z) illustrating axis-alignment
 * - Highlights active query/selection atoms producing the envelope
 * - Generates high-DPI contextual annotations for hover and inspection states
 * - Provides full lifecycle cleanup on dispose()
 */
export class MocsSpatialEnvelope {
  public readonly group: THREE.Group;
  private box: THREE.Box3;
  private options: SpatialEnvelopeOptions;

  // Managed Three.js scene objects
  public boxMesh?: THREE.Mesh;
  public wireframe?: THREE.LineSegments;
  public cornerBrackets?: THREE.LineSegments;
  public centroidMarker?: THREE.LineSegments;
  public extentAxes?: THREE.LineSegments;
  public annotationSprite?: THREE.Sprite;
  public atomReticles: THREE.LineSegments[] = [];

  constructor(box: THREE.Box3, options: SpatialEnvelopeOptions) {
    this.group = new THREE.Group();
    this.group.name = `MocsSpatialEnvelope_${options.target}_${options.semantic}`;
    this.box = box.clone();
    this.options = { ...options };

    this.rebuild();
  }

  /**
   * Rebuilds all visual sub-objects based on current box and options.
   */
  public rebuild(): void {
    this.clearObjects();

    if (this.box.isEmpty()) {
      return;
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    this.box.getSize(size);
    this.box.getCenter(center);

    const isSinglePoint = size.x === 0 && size.y === 0 && size.z === 0;
    const baseColorHex = this.options.color.startsWith('#')
      ? parseInt(this.options.color.slice(1), 16)
      : 0x10b981;

    // 1. Transparent Volume Faces (Subtle 0.03 opacity, DoubleSide prevents oblique back-face culling)
    if (!isSinglePoint && size.x > 0 && size.y > 0 && size.z > 0) {
      const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const faceMat = new THREE.MeshBasicMaterial({
        color: baseColorHex,
        transparent: true,
        opacity: 0.03,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.boxMesh = new THREE.Mesh(boxGeo, faceMat);
      this.boxMesh.position.copy(center);
      this.boxMesh.renderOrder = 1;
      this.group.add(this.boxMesh);

      // 2. 1px Crisp Primary Wireframe Edges (Subordinate to Corner Brackets)
      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: baseColorHex,
        linewidth: 1,
        transparent: true,
        opacity: this.options.isInspected || this.options.isHovered ? 0.85 : 0.65,
      });
      this.wireframe = new THREE.LineSegments(edgesGeo, edgeMat);
      this.wireframe.position.copy(center);
      this.wireframe.renderOrder = 2;
      this.group.add(this.wireframe);

      // 3. 3-Axis Orthogonal Corner Brackets (24 line segments at 8 vertices)
      const bracketsGeo = createCornerBrackets(this.box);
      const bracketMat = new THREE.LineBasicMaterial({
        color: baseColorHex,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.95,
      });
      this.cornerBrackets = new THREE.LineSegments(bracketsGeo, bracketMat);
      this.cornerBrackets.renderOrder = 3;
      this.group.add(this.cornerBrackets);
    }

    // 4. Centroid Marker: (min + max)/2 explicitly labeled "AABB center"
    if (this.options.isInspected || this.options.isHovered) {
      const centroidGeo = createCentroidCrosshair(center, Math.min(Math.max(size.x, size.y, size.z) * 0.15, 0.6));
      const centroidMat = new THREE.LineBasicMaterial({
        color: 0x0284c7, // Blue accent
        linewidth: 1.5,
        transparent: true,
        opacity: 0.9,
      });
      this.centroidMarker = new THREE.LineSegments(centroidGeo, centroidMat);
      this.centroidMarker.renderOrder = 4;
      this.group.add(this.centroidMarker);

      // 5. Miniature Extent Axes at Box Min (demonstrating axis-aligned orientation)
      const axesOrigin = isSinglePoint ? center : this.box.min;
      const axesLen = Math.min(Math.max(size.x, size.y, size.z) * 0.2, 1.2);
      const axesGeo = createExtentAxes(axesOrigin, axesLen > 0.2 ? axesLen : 0.6);
      const axesMat = new THREE.LineBasicMaterial({
        color: 0x475569, // Slate technical tone
        linewidth: 1.5,
        transparent: true,
        opacity: 0.85,
      });
      this.extentAxes = new THREE.LineSegments(axesGeo, axesMat);
      this.extentAxes.renderOrder = 4;
      this.group.add(this.extentAxes);
    }

    // 6. Contextual Technical Annotation Billboard Sprite (displayed strictly when inspected or hovered)
    if (this.options.isInspected || this.options.isHovered) {
      const lines = this.buildAnnotationLines(size);
      const spriteBg = this.options.target === 'protein'
        ? '#ECFDF5'
        : this.options.target === 'ligand'
        ? '#F5F3FF'
        : '#FFFBEB';
      const spriteBorder = this.options.target === 'protein'
        ? '#A7F3D0'
        : this.options.target === 'ligand'
        ? '#DDD6FE'
        : '#FDE68A';
      const spriteColor = this.options.target === 'protein'
        ? '#047857'
        : this.options.target === 'ligand'
        ? '#6D28D9'
        : '#B45309';

      this.annotationSprite = createAnnotationSprite(lines, spriteColor, spriteBorder, spriteBg);
      const labelPosY = isSinglePoint ? center.y + 0.6 : this.box.max.y + 0.45;
      this.annotationSprite.position.set(center.x, labelPosY, center.z);
      this.group.add(this.annotationSprite);
    }

    // 7. Atom Reticles around active coordinates (strictly gated to detailed inspection or hover)
    if (
      (this.options.isInspected || this.options.isHovered) &&
      this.options.atomCoords &&
      this.options.atomCoords.length > 0
    ) {
      for (const coord of this.options.atomCoords) {
        const pt = new THREE.Vector3(coord[0], coord[1], coord[2]);
        const reticleGeo = createCentroidCrosshair(pt, 0.4);
        const reticleMat = new THREE.LineBasicMaterial({
          color: baseColorHex,
          linewidth: 1.5,
          transparent: true,
          opacity: 0.8,
        });
        const reticle = new THREE.LineSegments(reticleGeo, reticleMat);
        reticle.renderOrder = 5;
        this.atomReticles.push(reticle);
        this.group.add(reticle);
      }
    }
  }

  /**
   * Constructs restrained, informative annotation text lines.
   */
  private buildAnnotationLines(size: THREE.Vector3): string[] {
    const isSinglePoint = size.x === 0 && size.y === 0 && size.z === 0;
    const targetTitle =
      this.options.target === 'protein'
        ? 'PROTEIN AABB'
        : this.options.target === 'ligand'
        ? 'LIGAND AABB'
        : 'BLOCK ENVELOPE';

    const selectionText = this.options.selectionLabel ? ` · ${this.options.selectionLabel}` : '';
    const provenanceText =
      this.options.semantic === 'block-envelope'
        ? `Block ${this.options.blockStart ?? 41} [${this.options.blockStart ?? 410}, ${this.options.blockEndExclusive ?? 420} ns)`
        : this.options.frame != null
        ? `Frame ${this.options.frame}`
        : 'Active Frame';

    const line1 = `${targetTitle}${selectionText}`;
    const line2 = isSinglePoint
      ? `${provenanceText} · Point Bound`
      : `ΔX ${size.x.toFixed(2)} · ΔY ${size.y.toFixed(2)} · ΔZ ${size.z.toFixed(2)} Å`;

    if (this.options.isInspected || this.options.isHovered) {
      const line3 = `Ext: [${this.box.min.x.toFixed(1)}, ${this.box.max.x.toFixed(1)}] × [${this.box.min.y.toFixed(1)}, ${this.box.max.y.toFixed(1)}] × [${this.box.min.z.toFixed(1)}, ${this.box.max.z.toFixed(1)}]`;
      return [line1, line2, line3];
    }

    return [line1, line2];
  }

  /**
   * Updates the envelope with new coordinates or options.
   */
  public update(box: THREE.Box3, options?: Partial<SpatialEnvelopeOptions>): void {
    this.box.copy(box);
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.rebuild();
  }

  /**
   * Toggles detailed inspection state.
   */
  public setInspected(inspected: boolean): void {
    if (this.options.isInspected !== inspected) {
      this.options.isInspected = inspected;
      this.rebuild();
    }
  }

  /**
   * Toggles hover highlight state.
   */
  public setHovered(hovered: boolean): void {
    if (this.options.isHovered !== hovered) {
      this.options.isHovered = hovered;
      this.rebuild();
    }
  }

  /**
   * Sets overall visibility of this envelope.
   */
  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * Returns exact AABB centroid: (min + max) / 2.
   */
  public getCenter(): THREE.Vector3 {
    return this.box.getCenter(new THREE.Vector3());
  }

  /**
   * Returns exact AABB dimensions.
   */
  public getDimensions(): BoxDimensions {
    return computeBoxDimensions(this.box);
  }

  /**
   * Returns exact AABB extrema without rounding drift.
   */
  public getExtrema(): BoxExtrema {
    return computeBoxExtrema(this.box);
  }

  /**
   * Returns copy of the exact underlying Box3.
   */
  public getBox3(): THREE.Box3 {
    return this.box.clone();
  }

  /**
   * Forensic geometry inspector debug metadata.
   */
  public getDebugInfo() {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    this.box.getSize(size);
    this.box.getCenter(center);
    return {
      target: this.options.target,
      semantic: this.options.semantic,
      selectionLabel: this.options.selectionLabel,
      color: this.options.color,
      min: [this.box.min.x, this.box.min.y, this.box.min.z],
      max: [this.box.max.x, this.box.max.y, this.box.max.z],
      center: [center.x, center.y, center.z],
      dimensions: [size.x, size.y, size.z],
      componentId: this.options.componentId,
      componentBound: this.options.componentBound,
    };
  }

  /**
   * Cleans up all Three.js geometries, materials, and sprite textures to prevent memory leaks.
   */
  private clearObjects(): void {
    const clearObj = (obj?: THREE.Object3D) => {
      if (!obj) return;
      this.group.remove(obj);
      if ((obj as any).geometry) {
        (obj as any).geometry.dispose();
      }
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if ((obj as any).material.map) (obj as any).material.map.dispose();
          (obj as any).material.dispose();
        }
      }
    };

    clearObj(this.boxMesh);
    this.boxMesh = undefined;

    clearObj(this.wireframe);
    this.wireframe = undefined;

    clearObj(this.cornerBrackets);
    this.cornerBrackets = undefined;

    clearObj(this.centroidMarker);
    this.centroidMarker = undefined;

    clearObj(this.extentAxes);
    this.extentAxes = undefined;

    clearObj(this.annotationSprite);
    this.annotationSprite = undefined;

    for (const reticle of this.atomReticles) {
      clearObj(reticle);
    }
    this.atomReticles = [];
  }

  /**
   * Destroys this spatial envelope and removes it from its parent.
   */
  public dispose(): void {
    this.clearObjects();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
