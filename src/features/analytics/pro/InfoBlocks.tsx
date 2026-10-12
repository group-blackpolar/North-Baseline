// Information-page blocks (hero, link cards, definition list). Static copy from the published document plus navigation: every number
// on such a page comes from bound kpi_card components. They fill their grid cell, adapt to its size with container queries and never
// invent data. Icons come from the closed vocabulary of the document schema.
import { CaretRight } from '@phosphor-icons/react';
import { createContext, useContext, type ReactNode } from 'react';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { useOptionalOrganization } from '@/context/OrganizationContext';
import { cn } from '@/lib/utils';
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
  return (
    <div className="@container relative isolate flex h-full min-h-0 items-center gap-4 overflow-hidden rounded-xl px-3 py-2 @[700px]:px-6">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))_0%,var(--color-surface)_55%,color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))_100%)]" />
      <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1/2 w-full text-accent opacity-[0.07]" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 70 C150 20 300 110 450 70 S750 20 900 70 S1100 100 1200 60 V120 H0Z" fill="currentColor" /><path d="M0 95 C200 55 350 125 550 90 S900 60 1200 100 V120 H0Z" fill="currentColor" opacity="0.7" /></svg>
      {props.showBrand === false ? null : <div className="hidden shrink-0 @[560px]:block"><OrgBrand props={{ showName: false }} size="hero" /></div>}
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
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <BlockTitle props={props} locales={locales} />
      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-2 overflow-y-auto @[520px]:grid-cols-2">
        {items.map((item, index) => {
          const slug = typeof item.panelSlug === 'string' ? item.panelSlug : null;
          const interactive = Boolean(slug && open);
          const inner: ReactNode = (
            <>
              <IconTile name={item.icon} tone={item.tone} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[0.84rem] font-semibold text-text">{localizedText(item.title, locales)}</span>
                {item.description ? <span className="line-clamp-2 text-[0.74rem] leading-snug text-text-secondary">{localizedText(item.description, locales)}</span> : null}
              </span>
              {interactive ? <CaretRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : null}
            </>
          );
          const base = 'flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-xs';
          return (
            <li key={typeof item.id === 'string' ? item.id : index}>
              {interactive
                ? <button type="button" onClick={() => open!(slug!)} className={cn(base, 'transition-colors hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40')}>{inner}</button>
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
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <BlockTitle props={props} locales={locales} />
      <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-surface">
        {items.map((item, index) => (
          <li key={typeof item.id === 'string' ? item.id : index} className="flex items-center gap-3 px-3 py-2">
            <IconTile name={item.icon} tone={item.tone} size="sm" />
            <span className="w-24 shrink-0 text-[0.8rem] font-semibold text-text @[420px]:w-32">{localizedText(item.term, locales)}</span>
            <span className="min-w-0 flex-1 text-[0.76rem] leading-snug text-text-secondary">{localizedText(item.text, locales)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
