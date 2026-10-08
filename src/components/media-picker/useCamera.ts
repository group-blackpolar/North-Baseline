import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { CameraController, type Facing } from './camera-controller.ts';
import { fitSide, MAX_WORK_SIDE } from './logic.ts';

export type { Facing };

/** React binding of `CameraController`: it only exists while `active`, and follows page visibility. */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [canSwitch, setCanSwitch] = useState(false);
  const controller = useRef<CameraController | null>(null);
  if (!controller.current && typeof navigator !== 'undefined') {
    controller.current = new CameraController({
      getUserMedia: (facing) => {
        if (!navigator.mediaDevices?.getUserMedia) return Promise.reject({ name: 'UnsupportedError' });
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      },
    }, rerender);
  }
  const camera = controller.current!;
  const unsupported = typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    camera.set({ active });
  }, [camera, active]);

  useEffect(() => {
    const sync = () => camera.set({ visible: document.visibilityState === 'visible' });
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => camera.set({ visible: false }));
    return () => { document.removeEventListener('visibilitychange', sync); camera.dispose(); };
  }, [camera]);

  // The <video> mirrors the controller's stream; clearing it drops the last frame reference.
  const stream = camera.stream as MediaStream | null;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
      void navigator.mediaDevices.enumerateDevices().then((devices) => setCanSwitch(devices.filter((device) => device.kind === 'videoinput').length > 1)).catch(() => undefined);
    }
  }, [stream]);

  const capture = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const { w, h } = fitSide(video.videoWidth, video.videoHeight, MAX_WORK_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    canvas.width = canvas.height = 0; // release the pixel buffer right away
    return blob ? new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null;
  }, []);

  return {
    videoRef, capture, canSwitch,
    state: unsupported && active ? ('unsupported' as const) : active && camera.state === 'idle' ? ('starting' as const) : camera.state,
    facing: camera.currentFacing as Facing,
    flip: () => camera.set({ facing: camera.currentFacing === 'user' ? 'environment' : 'user' }),
    retry: () => camera.retry(),
  };
}

export type CameraApi = ReturnType<typeof useCamera>;
