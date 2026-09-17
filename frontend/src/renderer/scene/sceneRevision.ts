export class SceneRevisionManager {
  private currentRevision = 0;

  get current(): number {
    return this.currentRevision;
  }

  next(): number {
    this.currentRevision += 1;
    return this.currentRevision;
  }

  isStale(revision: number): boolean {
    return revision < this.currentRevision;
  }
}
