import { useState, type CSSProperties } from 'react';
import { ArrowUpRight, HourglassMedium, LockSimple, WarningCircle } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import type { CardState } from './cardState';
export type { CardState };

const PHOTO = '/brand/shark-port-hero.webp';

export function ReportCard({ name, description, icon: Glyph, accent, crop, state, index, onOpen }: {
  name: string; description?: string; icon: IconComponent; accent: string; crop: { position: string; scale: number };
  state: CardState; index: number; onOpen?: () => void;
}) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const muted = state !== 'allowed' && state !== 'loading';
  const style = { '--accent-card': accent, '--i': index } as CSSProperties;
  const status = {
    allowed: { label: t('oh.state.allowed'), tone: 'text-emerald-300' },
    restricted: { label: t('oh.state.restricted'), tone: 'text-slate-200' },
    unavailable: { label: t('oh.state.unavailable'), tone: 'text-slate-300' },
    unknown: { label: t('oh.state.unknown'), tone: 'text-amber-200' },
    loading: { label: '', tone: '' },
  }[state];
  const StateIcon = state === 'restricted' ? LockSimple : state === 'unavailable' ? HourglassMedium : state === 'unknown' ? WarningCircle : null;

  const body = (
    <>
      {/* Image layer: decorative and replaceable. Name, icon and colour carry the meaning if it never loads. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 38%, #0B1D30), #0B1D30 70%)` }} />
        {!imageFailed && state !== 'loading' ? (
          <img src={PHOTO} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)}
            className={cn('absolute inset-0 size-full object-cover transition-[filter,transform,opacity] duration-300', muted ? 'scale-[1.05] opacity-40 blur-[3px] saturate-50' : 'opacity-55 group-hover/card:scale-[1.04]')}
            style={{ objectPosition: crop.position, transform: muted ? undefined : `scale(${crop.scale})`, transformOrigin: crop.position }} />
        ) : null}
        <div className={cn('absolute inset-0', muted ? 'bg-[#061321]/70' : 'bg-gradient-to-t from-[#061321] via-[#061321]/70 to-[#061321]/20')} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${muted ? '#64748b' : accent}, transparent)` }} />
      </div>

      <div className="relative flex h-full min-h-52 flex-col justify-between gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-white/15 bg-[#061321]/70" style={{ color: muted ? '#cbd5e1' : accent }}>
            <Glyph size={24} weight="duotone" aria-hidden="true" />
          </span>
          {state === 'allowed' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">{status.label}</span>
          ) : StateIcon ? (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#061321]/80 px-2.5 py-1 text-[11px] font-medium', status.tone)}>
              <StateIcon size={14} weight={state === 'restricted' ? 'fill' : 'regular'} aria-hidden="true" />{status.label}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <h3 className="font-display text-lg font-semibold leading-tight text-white">{name}</h3>
          <div className="min-h-[3.9rem]">
          {state === 'restricted' ? <p className="text-sm leading-snug text-slate-200">{t('oh.restrictedBody')}</p> : state === 'unavailable' ? <p className="text-sm leading-snug text-slate-300">{t('oh.unavailableBody')}</p> : state === 'unknown' ? <p className="text-sm leading-snug text-slate-300">{t('oh.unknownBody')}</p> : description ? <p className="text-sm leading-snug text-slate-300">{description}</p> : null}
          </div>
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

  const base = 'group/card oh-rise relative block overflow-hidden rounded-2xl border text-left';
  if (state === 'allowed') {
    return (
      <button type="button" onClick={onOpen} style={style} aria-label={`${t('oh.open')}: ${name}`}
        className={cn(base, 'border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-card)] hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-card)] active:translate-y-0 pointer-coarse:min-h-(--touch-min)')}>
        {body}
      </button>
    );
  }
  return (
    <div style={style} role="group" aria-label={`${name}: ${status.label}`} aria-busy={state === 'loading' || undefined}
      className={cn(base, 'border-white/10', state === 'loading' && 'animate-pulse')}>
      {body}
    </div>
  );
}
