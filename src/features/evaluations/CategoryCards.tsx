import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n';
import { useCategoryImage } from './useCategoryImage';
import type { CategoriesView, CategoryRow } from './model';

export type CategorySummary = Pick<CategoryRow, 'name' | 'description' | 'color' | 'imageAssetId' | 'counts'>;

/**
 * One category card: identity colour (data, applied as an accent and a soft tint so text keeps the theme's contrast), optional decorative image under
 * an overlay, short description, real counts and progress. Compact on phones (one column), two columns on desktop.
 */
export function CategoryCard({ organizationId, category, onOpen }: { organizationId: string; category: CategorySummary; onOpen: () => void }) {
  const { t } = useI18n();
  const image = useCategoryImage(organizationId, category.imageAssetId);
  const { total, completed, inProgress } = category.counts;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const accent = { '--cat': category.color } as CSSProperties;
  return (
    <button type="button" onClick={onOpen} style={accent}
      className="group relative isolate flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-left outline-none transition-colors hover:border-[var(--cat)] focus-visible:ring-2 focus-visible:ring-[var(--cat)] sm:p-5">
      <span aria-hidden className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--cat)_9%,transparent)]" />
      {image ? <img src={image} alt="" aria-hidden loading="lazy" className="absolute inset-y-0 right-0 -z-10 h-full w-2/3 object-cover opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" /> : null}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--cat)]" />
      <div className="flex items-start gap-3 pl-1.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--cat)_16%,transparent)] text-[var(--cat)]"><BookOpen className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="font-display text-lg font-semibold leading-tight text-text [overflow-wrap:anywhere]">{category.name}</h3>
          {category.description ? <p className="line-clamp-2 text-sm text-text-secondary">{category.description}</p> : null}
        </div>
        <ArrowRight className="mt-1 size-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <div className="space-y-1.5 pl-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-text-secondary">
          <span>{[t('st.cat.available', { n: total }), t('st.cat.completed', { n: completed }), inProgress ? t('st.cat.inProgress', { n: inProgress }) : null].filter(Boolean).join(' · ')}</span>
          <span className="font-medium tabular-nums text-text">{percent} %</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-label={t('st.cat.progress')} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[var(--cat)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </button>
  );
}

/** The home of Stress Test: category cards (persisted, ordered), plus a card for assigned exams that have no category yet. */
export function CategoryGrid({ organizationId, view, onOpen }: { organizationId: string; view: CategoriesView; onOpen: (key: string) => void }) {
  const { t } = useI18n();
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {view.categories.map((category) => <li key={category.id}><CategoryCard organizationId={organizationId} category={category} onOpen={() => onOpen(category.key)} /></li>)}
      {view.uncategorized.total > 0 ? (
        <li><CategoryCard organizationId={organizationId} onOpen={() => onOpen('')} category={{ name: t('st.cat.uncategorized'), description: t('st.cat.uncategorizedHint'), color: '#64748b', imageAssetId: null, counts: view.uncategorized }} /></li>
      ) : null}
    </ul>
  );
}
