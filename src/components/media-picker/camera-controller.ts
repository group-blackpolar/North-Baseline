// Camera lifecycle without React: one live stream at most, always released. Unit-tested with `node --test`.
import { classifyCameraError, stopStream, type CameraState } from './logic.ts';

export type Facing = 'user' | 'environment';
export interface TrackLike { stop(): void; onended: ((event: Event) => unknown) | null }
export interface StreamLike { getTracks(): TrackLike[] }
export interface CameraHost { getUserMedia(facing: Facing): Promise<StreamLike> }

/**
 * Desired state is `active && visible`. Leaving the page, locking the phone or switching apps (hidden) releases the
 * tracks so the camera indicator goes off; coming back restarts automatically. If the restart needs a user gesture
 * (common on iOS) or the OS took the camera (track `ended`), the state becomes `interrupted` and the UI shows a resume
 * button. Every start has a generation number: a stream that resolves after it was superseded is stopped, so rapid
 * changes (flip, close, hide) can never leave two live streams.
 */
export class CameraController {
  state: CameraState = 'idle';
  stream: StreamLike | null = null;
  private active = false;
  private visible = true;
  private facing: Facing = 'environment';
  private runFacing: Facing | null = null;
  private generation = 0;
  private readonly host: CameraHost;
  private readonly onChange: () => void;

  constructor(host: CameraHost, onChange: () => void) { this.host = host; this.onChange = onChange; }

  get currentFacing() { return this.facing; }

  set(next: { active?: boolean; visible?: boolean; facing?: Facing }) {
    const resumed = next.visible === true && !this.visible;
    if (next.active !== undefined) this.active = next.active;
    if (next.visible !== undefined) this.visible = next.visible;
    if (next.facing !== undefined) this.facing = next.facing;
    this.reconcile(false, resumed);
  }

  /** User-initiated retry / resume. */
  retry() { this.reconcile(true, false); }

  dispose() { this.active = false; this.reconcile(false, false); }

  private release() {
    this.generation++;
    stopStream(this.stream);
    this.stream = null;
    this.runFacing = null;
  }

  private reconcile(force: boolean, resumed: boolean) {
    if (!(this.active && this.visible)) {
      const had = this.stream !== null || this.state !== 'idle';
      this.release();
      this.state = 'idle';
      if (had) this.onChange();
      return;
    }
    if (!force && this.runFacing === this.facing && (this.stream || this.state === 'starting')) return;
    this.release();
    const run = this.generation;
    this.runFacing = this.facing;
    this.state = 'starting';
    this.onChange();
    this.host.getUserMedia(this.facing).then(
      (stream) => {
        if (run !== this.generation) { stopStream(stream); return; }
        this.stream = stream;
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            if (run !== this.generation) return;
            this.release();
            this.state = 'interrupted';
            this.onChange();
          };
        });
        this.state = 'ready';
        this.onChange();
      },
      (error) => {
        if (run !== this.generation) return;
        this.runFacing = null;
        this.state = resumed ? 'interrupted' : classifyCameraError(error);
        this.onChange();
      },
    );
  }
}
