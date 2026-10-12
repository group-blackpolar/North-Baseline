// Information-page blocks (hero, link cards, definition list). Static copy from the published document plus navigation: every number
// on such a page comes from bound kpi_card components. They fill their grid cell, adapt to its size with container queries and never
// invent data. Icons come from the closed vocabulary of the document schema.
import { CaretRight } from '@phosphor-icons/react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { useOptionalOrganization } from '@/context/OrganizationContext';
import { cn } from '@/lib/utils';
import { useElementSize } from '../cellFill';
import { localizedText, TONE_VARS, toneOf } from './format';
import { iconOf } from './icons';

type Props = Record<string, unknown>;

/** Opens another published panel of the organization. Absent in the public showcase, where cards are not interactive. */
export const PanelNavigationContext = createContext<((panelSlug: string) => void) | null>(null);
export const usePanelNavigation = () => useContext(PanelNavigationContext);

const records = (value: unknown): Props[] => (Array.isArray(value) ? value.filter((item): item is Props => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []);

/** The active organization's logo (and optionally its name). */
export function OrgBrand({ props, size = 'auto' }: { props: Props; size?: 'auto' | 'hero' }) {
  const organization = useOptionalOrganization()?.activeOrganization as { name: string; id: string; iconData?: string | null; iconAssetId?: string | null } | null | undefined;
  if (!organization) return null;
  const align = props.align === 'center' ? 'justify-center' : props.align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <div className={cn('flex h-full min-h-0 items-center gap-3', align)}>
      <OrganizationAvatar name={organization.name} organizationId={organization.id} iconAssetId={organization.iconAssetId} iconData={organization.iconData}
        className={cn('aspect-square rounded-lg bg-transparent', size === 'hero' ? 'size-16 @[900px]:size-24' : 'size-full max-h-16 w-auto max-w-40')} />
      {props.showName === false ? null : <span className="truncate font-display text-lg font-semibold tracking-wide text-text">{organization.name}</span>}
    </div>
  );
}

function IconTile({ name, tone, size = 'md' }: { name: unknown; tone?: unknown; size?: 'sm' | 'md' | 'lg' }) {
  const Glyph = iconOf(name);
  const colors = TONE_VARS[toneOf(tone)];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl', size === 'lg' ? 'size-12' : size === 'md' ? 'size-10' : 'size-8')} style={{ background: colors.bg, color: colors.fg }} aria-hidden="true">
      <Glyph weight="fill" className={size === 'lg' ? 'size-6' : size === 'md' ? 'size-5' : 'size-4'} />
    </span>
  );
}

export function HeroBlock({ props, locales }: { props: Props; locales: string[] }) {
  const eyebrow = localizedText(props.eyebrow, locales);
  const title = localizedText(props.title, locales);
  const body = localizedText(props.body, locales);
  const chips = records(props.chips);
  const aside = props.aside && typeof props.aside === 'object' ? props.aside as Props : null;
  const AsideIcon = aside ? iconOf(aside.icon) : null;
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="@container relative isolate flex h-full min-h-0 items-center gap-4 overflow-hidden rounded-xl px-3 py-2 @[700px]:px-6">
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--color-accent)_7%,var(--color-surface))_0%,var(--color-surface)_45%,color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface))_100%)]" />
      {/* Illustrated port scene (cranes, a container ship, water). A real photograph shipped under /brand/ is drawn over it and the scene stays as the fallback. */}
      <svg aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 h-full w-[68%] text-accent" viewBox="0 0 700 220" preserveAspectRatio="xMaxYMax slice">
        <defs><linearGradient id="hero-fade" x1="0" x2="1"><stop offset="0" stopColor="var(--color-surface)" /><stop offset="0.55" stopColor="var(--color-surface)" stopOpacity="0" /></linearGradient></defs>
        <rect x="0" y="150" width="700" height="70" fill="currentColor" opacity="0.1" />
        <path d="M0 160 q35 -8 70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0 t70 0" fill="none" stroke="currentColor" opacity="0.18" strokeWidth="2" />
        <g fill="currentColor" opacity="0.2"><path d="M180 150 h330 l-26 30 h-282z" /><rect x="205" y="112" width="270" height="38" opacity="0.55" /></g>
        <g opacity="0.3">{Array.from({ length: 9 }, (_, i) => <rect key={i} x={210 + i * 29} y={118 + (i % 3) * 9} width="24" height="9" fill={['#2F6FED', '#E0475B', '#D98A0B', '#1F9D63', '#7C5CFC'][i % 5]} />)}</g>
        <g stroke="currentColor" strokeWidth="3" opacity="0.28" fill="none"><path d="M560 160 V50 M560 50 H470 M470 50 L440 75 M560 50 L610 40 M520 50 L560 160" /><path d="M640 160 V80 M640 80 H585" /></g>
        <rect width="700" height="220" fill="url(#hero-fade)" />
      </svg>
      {props.backgroundImage && typeof props.backgroundImage === 'string' && !imageFailed ? (
        <>
          <img src={props.backgroundImage} alt="" aria-hidden="true" onError={() => setImageFailed(true)} className="absolute inset-y-0 right-0 -z-10 h-full w-[72%] object-cover object-right" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--color-surface)_0%,color-mix(in_srgb,var(--color-surface)_92%,transparent)_34%,transparent_70%)]" />
        </>
      ) : null}
      {props.showBrand === false ? null : <div className="hidden shrink-0 @[560px]:block">{typeof props.logoImage === 'string' ? <img src={props.logoImage} alt="" className="h-full max-h-24 w-auto rounded-lg bg-white object-contain p-1 @[900px]:max-h-28" /> : <OrgBrand props={{ showName: false }} size="hero" />}</div>}
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-text-muted @[700px]:text-[0.7rem]">{eyebrow}</p> : null}
        <h2 className="font-display text-[clamp(1.1rem,3.6cqw,2.25rem)] font-extrabold uppercase leading-[1.05] tracking-tight text-text">{title}</h2>
        {body ? <p className="mt-1 line-clamp-3 max-w-[62ch] text-[0.74rem] leading-snug text-text-secondary @[700px]:text-[0.84rem]">{body}</p> : null}
        {chips.length ? (
          <ul className="mt-2 hidden flex-wrap gap-2 @[560px]:flex">
            {chips.map((chip, index) => { const Glyph = iconOf(chip.icon); return <li key={index} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-text-secondary"><Glyph className="size-3.5" aria-hidden="true" />{localizedText(chip.label, locales)}</li>; })}
          </ul>
        ) : null}
      </div>
      {aside && AsideIcon ? (
        <aside className="hidden max-w-[17rem] shrink-0 rounded-xl border border-border/70 bg-surface/70 p-3 shadow-xs backdrop-blur-sm @[1000px]:block">
          <div className="flex items-start gap-3">
            <AsideIcon className="mt-0.5 size-7 shrink-0 text-accent" weight="bold" aria-hidden="true" />
            <div className="min-w-0"><p className="text-sm font-semibold leading-snug text-text">{localizedText(aside.title, locales)}</p>{aside.body ? <p className="mt-1 text-xs leading-snug text-text-secondary">{localizedText(aside.body, locales)}</p> : null}</div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function BlockTitle({ props, locales }: { props: Props; locales: string[] }) {
  const title = localizedText(props.title, locales);
  if (!title) return null;
  const Glyph = iconOf(props.icon);
  return <h3 className="mb-2 flex shrink-0 items-center gap-2 font-display text-[0.95rem] font-semibold text-text"><Glyph className="size-5 text-accent" weight="fill" aria-hidden="true" />{title}</h3>;
}

export function LinkCardsBlock({ props, locales }: { props: Props; locales: string[] }) {
  const open = usePanelNavigation();
  const items = records(props.items);
  const [box, size] = useElementSize<HTMLUListElement>();
  const columns = size.width >= 520 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(items.length / columns));
  // The cards share the height equally; description lines and padding give way before anything scrolls or is cut off.
  const each = size.height > 0 ? (size.height - (rows - 1) * 8) / rows : 80;
  const showDescription = each >= 58;
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <BlockTitle props={props} locales={locales} />
      <ul ref={box} className={cn('grid min-h-0 flex-1 gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')} style={{ gridAutoRows: 'minmax(0, 1fr)' }}>
        {items.map((item, index) => {
          const slug = typeof item.panelSlug === 'string' ? item.panelSlug : null;
          const interactive = Boolean(slug && open);
          const inner: ReactNode = (
            <>
              <IconTile name={item.icon} tone={item.tone} size={each >= 62 ? 'md' : 'sm'} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[0.84rem] font-semibold leading-tight text-text">{localizedText(item.title, locales)}</span>
                {item.description && showDescription ? <span className="line-clamp-2 text-[0.74rem] leading-snug text-text-secondary">{localizedText(item.description, locales)}</span> : null}
              </span>
              {interactive ? <CaretRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : null}
            </>
          );
          const base = 'flex h-full w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface px-2.5 shadow-xs';
          return (
            <li key={typeof item.id === 'string' ? item.id : index} className="min-h-0 min-w-0">
              {interactive
                ? <button type="button" onClick={() => open!(slug!)} title={item.description ? localizedText(item.description, locales) : undefined} className={cn(base, 'transition-colors hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40')}>{inner}</button>
                : <div className={base}>{inner}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DefinitionListBlock({ props, locales }: { props: Props; locales: string[] }) {
  const items = records(props.items);
  const [box, size] = useElementSize<HTMLUListElement>();
  const each = size.height > 0 && items.length ? size.height / items.length : 60;
  const twoLines = each >= 44;
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <BlockTitle props={props} locales={locales} />
      <ul ref={box} className="flex min-h-0 flex-1 flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
        {items.map((item, index) => (
          <li key={typeof item.id === 'string' ? item.id : index} className="flex min-h-0 flex-1 items-center gap-3 px-3">
            {each >= 34 ? <IconTile name={item.icon} tone={item.tone} size="sm" /> : null}
            <span className="w-24 shrink-0 truncate text-[0.8rem] font-semibold text-text @[420px]:w-32">{localizedText(item.term, locales)}</span>
            <span className={cn('min-w-0 flex-1 text-[0.76rem] leading-snug text-text-secondary', twoLines ? 'line-clamp-2' : 'truncate')} title={localizedText(item.text, locales)}>{localizedText(item.text, locales)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
