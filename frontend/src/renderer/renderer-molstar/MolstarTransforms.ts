import { PluginStateObject as SO, PluginStateTransform } from 'molstar/lib/mol-plugin-state/objects.js';
import { Lines } from 'molstar/lib/mol-geo/geometry/lines/lines.js';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh.js';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition.js';
import { Task } from 'molstar/lib/mol-task/index.js';
import { createAABBShape, createCaliperShape, createReticleShape } from './MolstarProofGeometry.js';
import { ScientificAABB, MeasurementCaliper } from '@mocs/geometry';
import { AABBStyle } from '@mocs/scene';

export const MocsAABBShapeTransform = PluginStateTransform.BuiltIn({
  name: 'mocs-aabb-shape',
  display: 'MOCS AABB Shape',
  from: SO.Root,
  to: SO.Shape.Provider,
  params: {
    aabb: PD.Value<ScientificAABB>({} as ScientificAABB),
    style: PD.Value<AABBStyle>('wireframe'),
    colorHex: PD.Numeric(0x38bdf8),
    label: PD.Text('AABB'),
  },
})({
  apply({ params }) {
    return Task.create('MOCS AABB Shape Provider', async () => {
      const shape = createAABBShape(params.aabb, params.style, params.colorHex, params.label);
      return new SO.Shape.Provider(
        {
          label: params.label,
          data: params,
          params: Lines.Params,
          getShape: () => shape,
          geometryUtils: Lines.Utils,
        },
        { label: params.label }
      );
    });
  },
});

export const MocsCaliperShapeTransform = PluginStateTransform.BuiltIn({
  name: 'mocs-caliper-shape',
  display: 'MOCS Caliper Shape',
  from: SO.Root,
  to: SO.Shape.Provider,
  params: {
    caliper: PD.Value<MeasurementCaliper>({} as MeasurementCaliper),
    colorHex: PD.Numeric(0x10b981),
    label: PD.Text('Caliper'),
  },
})({
  apply({ params }) {
    return Task.create('MOCS Caliper Shape Provider', async () => {
      const shape = createCaliperShape(params.caliper, params.colorHex, params.label);
      return new SO.Shape.Provider(
        {
          label: params.label,
          data: params,
          params: Lines.Params,
          getShape: () => shape,
          geometryUtils: Lines.Utils,
        },
        { label: params.label }
      );
    });
  },
});

export const MocsReticleShapeTransform = PluginStateTransform.BuiltIn({
  name: 'mocs-reticle-shape',
  display: 'MOCS Reticle Shape',
  from: SO.Root,
  to: SO.Shape.Provider,
  params: {
    position: PD.Value<readonly [number, number, number]>([0, 0, 0]),
    colorHex: PD.Numeric(0xfbbf24),
    label: PD.Text('Reticle'),
  },
})({
  apply({ params }) {
    return Task.create('MOCS Reticle Shape Provider', async () => {
      const shape = createReticleShape(params.position, params.colorHex, params.label);
      return new SO.Shape.Provider(
        {
          label: params.label,
          data: params,
          params: Mesh.Params,
          getShape: () => shape,
          geometryUtils: Mesh.Utils,
        },
        { label: params.label }
      );
    });
  },
});
