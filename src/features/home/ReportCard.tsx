import { useState, type CSSProperties } from 'react';
import { ArrowUpRight, HourglassMedium, LockSimple, WarningCircle } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { CardState } from './cardState';
export type { CardState };

const PHOTO = '/brand/shark-port-hero.webp';

/** Colours come only from the active theme tokens (`accent` is a `var(--chart-N)` / `var(--color-accent)` reference), so every theme and organization brand is respected. */
export function ReportCard({ name, description, icon: Glyph, accent, crop, state, index, onOpen }: {
  name: string; description?: string; icon: IconComponent; accent: string; crop: { position: string; scale: number };
  state: CardState; index: number; onOpen?: () => void;
}) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const muted = state !== 'allowed' && state !== 'loading';
  const style = { '--accent-card': accent, '--i': index } as CSSProperties;
  const labels: Record<CardState, string> = {
    allowed: t('oh.state.allowed'), restricted: t('oh.state.restricted'), unavailable: t('oh.state.unavailable'), unknown: t('oh.state.unknown'), loading: '',
  };
  const StateIcon = state === 'restricted' ? LockSimple : state === 'unavailable' ? HourglassMedium : state === 'unknown' ? WarningCircle : null;
  const copy = state === 'restricted' ? t('oh.restrictedBody') : state === 'unavailable' ? t('oh.unavailableBody') : state === 'unknown' ? t('oh.unknownBody') : description;

  const body = (
    <>
      {/* Image layer: decorative and replaceable. Name, icon and colour carry the meaning if it never loads. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 30%, var(--color-surface)), var(--color-surface) 75%)` }} />
        {!imageFailed && state !== 'loading' ? (
          <img src={PHOTO} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)}
            className={cn('absolute inset-0 size-full object-cover transition-[filter,transform,opacity] duration-300', muted ? 'opacity-40 blur-[3px] saturate-50' : 'opacity-70 group-hover/card:opacity-85')}
            style={{ objectPosition: crop.position, transform: `scale(${muted ? 1.05 : crop.scale})`, transformOrigin: crop.position }} />
        ) : null}
        {/* The surface colour fades the photo out under the text, so contrast holds in light, dark and midnight. */}
        <div className={cn('absolute inset-0', muted ? 'bg-surface/70' : 'bg-gradient-to-t from-surface via-surface/75 to-transparent')} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${muted ? 'var(--color-border-strong)' : accent}, transparent)` }} />
      </div>

      <div className="relative flex h-full min-h-52 flex-col justify-between gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface" style={{ color: muted ? 'var(--color-text-secondary)' : accent }}>
            <Glyph size={24} weight="duotone" aria-hidden="true" />
          </span>
          {state === 'allowed' ? (
            <span className="inline-flex items-center rounded-full border border-success/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-success">{labels.allowed}</span>
          ) : StateIcon ? (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-[11px] font-medium', state === 'unknown' ? 'text-warning' : 'text-text-secondary')}>
              <StateIcon size={14} weight={state === 'restricted' ? 'fill' : 'regular'} aria-hidden="true" />{labels[state]}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <h3 className="font-display text-lg font-semibold leading-tight text-text">{name}</h3>
          <div className="min-h-[3.9rem]">{copy ? <p className="text-sm leading-snug text-text-secondary">{copy}</p> : null}</div>
          <div className="h-7">
            {state === 'allowed' ? (
              <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium transition-transform duration-200 group-hover/card:translate-x-0.5" style={{ color: accent }}>
                {t('oh.open')}<ArrowUpRight size={16} weight="bold" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  const base = 'group/card oh-rise relative block overflow-hidden rounded-2xl border border-border bg-surface text-left';
  if (state === 'allowed') {
    return (
      <button type="button" onClick={onOpen} style={style} aria-label={`${t('oh.open')}: ${name}`}
        className={cn(base, 'shadow-soft transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-(--accent-card) hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-card) active:translate-y-0 pointer-coarse:min-h-(--touch-min)')}>
        {body}
      </button>
    );
  }
  return (
    <div style={style} role="group" aria-label={`${name}: ${labels[state] || name}`} aria-busy={state === 'loading' || undefined} className={cn(base, state === 'loading' && 'animate-pulse')}>
      {body}
    </div>
  );
}
