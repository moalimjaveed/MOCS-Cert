import { PluginContext } from 'molstar/lib/mol-plugin/context.js';
import { CameraProjectionMode } from '@mocs/scene';
import { CameraOptions, FocusTarget } from '@mocs/render-contract';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra.js';

export class MolstarCameraManager {
  constructor(private readonly plugin: PluginContext) {}

  setCameraMode(mode: CameraProjectionMode): void {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return;
    canvas3d.camera.setState({ mode });
    canvas3d.requestDraw();
  }

  fitStructure(options?: CameraOptions): void {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return;
    canvas3d.requestCameraReset({ durationMs: options?.durationMs ?? 250 });
  }

  focusPosition(target: FocusTarget, options?: CameraOptions): void {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return;

    const vecTarget = Vec3.create(target.position[0], target.position[1], target.position[2]);
    const radius = target.radius ?? 20.0;
    const durationMs = options?.durationMs ?? 250;

    canvas3d.camera.focus(vecTarget, radius, durationMs);
    canvas3d.requestDraw();
  }

  getCameraPosition(): [number, number, number] {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return [0, 0, 100];
    const pos = canvas3d.camera.position;
    return [pos[0], pos[1], pos[2]];
  }

  getSnapshot(): any {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return null;
    return canvas3d.camera.getSnapshot();
  }

  setSnapshot(snapshot: any, durationMs: number = 250): void {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d || !snapshot) return;
    canvas3d.camera.setState(snapshot, durationMs);
    canvas3d.requestDraw();
  }

  subscribeCameraMovement(callback: () => void): () => void {
    const canvas3d = this.plugin.canvas3d;
    if (!canvas3d) return () => {};
    const sub = canvas3d.camera.stateChanged.subscribe(() => {
      callback();
    });
    return () => sub.unsubscribe();
  }
}
