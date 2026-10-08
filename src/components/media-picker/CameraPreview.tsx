import { CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CameraApi } from './useCamera.ts';

/** Live video plus the camera state messages. Always offers a way out to the file picker. */
export function CameraPreview({ camera, onChooseFile, className }: { camera: CameraApi; onChooseFile: () => void; className?: string }) {
  const { t } = useI18n();
  const { state } = camera;
  const failed = state === 'denied' || state === 'notfound' || state === 'busy' || state === 'unsupported' || state === 'error' || state === 'interrupted';
  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      <video
        ref={camera.videoRef}
        playsInline muted autoPlay
        aria-hidden={state !== 'ready'}
        className={cn('size-full object-cover transition-opacity duration-(--duration-normal)', camera.facing === 'user' && '-scale-x-100', state === 'ready' ? 'opacity-100' : 'opacity-0')}
      />
      {state === 'starting' && (
        <div role="status" className="absolute inset-0 grid place-items-center text-sm text-white/80">
          <span className="flex items-center gap-2"><CircleNotch className="size-4 animate-spin" />{t('media.cam.starting')}</span>
        </div>
      )}
      {failed && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="max-w-xs text-sm text-white/85">{t(`media.cam.${state}` as 'media.cam.error')}</p>
          <div className="flex gap-2">
            {(state === 'error' || state === 'busy' || state === 'interrupted') && <Button variant="secondary" onClick={camera.retry}>{state === 'interrupted' ? t('media.cam.resume') : t('media.cam.retry')}</Button>}
            <Button variant="accent" onClick={onChooseFile}>{t('media.chooseFile')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
