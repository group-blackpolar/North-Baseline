import { ArrowCounterClockwise, ArrowClockwise, ArrowLeft, ArrowUpRight, Check, CircleNotch, ClockCounterClockwise, DeviceMobile, DeviceTablet, Desktop, Eye, FloppyDisk, Gear, PencilSimple, SidebarSimple, Stack, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useViewsEditor, type ActiveTabMode } from '../ViewsEditorContext';
import { DEVICES, type Device } from './registry';

const MODES: Array<{ id: ActiveTabMode; icon: typeof Eye; key: 'st.mode.edit' | 'st.mode.preview' | 'st.mode.settings' | 'st.mode.versions' }> = [
  { id: 'editor', icon: PencilSimple, key: 'st.mode.edit' },
  { id: 'preview', icon: Eye, key: 'st.mode.preview' },
  { id: 'settings', icon: Gear, key: 'st.mode.settings' },
  { id: 'revisions', icon: ClockCounterClockwise, key: 'st.mode.versions' },
];
const DEVICE_ICON: Record<Device, typeof Desktop> = { desktop: Desktop, tablet: DeviceTablet, mobile: DeviceMobile };

export function StudioToolbar({ compact, exiting, issues, onExit, onPublish, onValidate, validating, onToggleLibrary, onToggleInspector, libraryOpen, inspectorOpen }: {
  compact: boolean;
  exiting: boolean;
  issues: { errors: number; warnings: number } | null;
  onExit: () => void;
  onPublish: () => void;
  onValidate: () => void;
  validating: boolean;
  onToggleLibrary: () => void;
  onToggleInspector: () => void;
  libraryOpen: boolean;
  inspectorOpen: boolean;
}) {
  const { t, locale } = useI18n();
  const { activePanel, activeMode, setActiveMode, device, setDevice, undo, redo, canUndo, canRedo, isDirty, saveStatus, saveError, saveNow, conflict } = useViewsEditor();
  const name = activePanel ? activePanel.name[locale] ?? activePanel.name.es ?? activePanel.name.en ?? Object.values(activePanel.name)[0] ?? '' : '';
  const saving = saveStatus === 'saving';
  const state = conflict || saveError === 'conflict' ? 'conflict' : saveError === 'unsafe' ? 'unsafe' : saveStatus === 'error' ? 'failed' : saving ? 'saving' : isDirty ? 'unsaved' : saveStatus === 'saved' ? 'saved' : 'idle';
  const stateTone = { conflict: 'error', unsafe: 'error', failed: 'error', saving: 'info', unsaved: 'pending', saved: 'active', idle: 'neutral' } as const;
  const published = activePanel?.status === 'PUBLISHED';
  const editing = activeMode === 'editor';

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-surface px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Button size="sm" variant="ghost" loading={exiting} onClick={onExit} aria-label={t('st.toolbar.exit')}><ArrowLeft aria-hidden="true" /><span className="max-sm:hidden">{t('st.toolbar.exit')}</span></Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-sm font-semibold leading-4 text-text">{name}</h1>
          <p className="truncate font-mono text-[11px] leading-4 text-text-muted">/{activePanel?.slug}</p>
        </div>
        <Status tone={published ? 'active' : 'neutral'}>{published ? t('st.status.published') : activePanel?.status === 'ARCHIVED' ? t('st.status.archived') : t('st.status.draft')}</Status>
      </div>

      {compact && editing ? (
        <div className="flex items-center gap-1">
          <IconButton label={t('st.library.title')} icon={<Stack />} aria-pressed={libraryOpen} onClick={onToggleLibrary} />
          <IconButton label={t('st.inspector.title')} icon={<SidebarSimple mirrored />} aria-pressed={inspectorOpen} onClick={onToggleInspector} />
        </div>
      ) : null}

      <nav aria-label={t('st.toolbar.modes')} className="flex items-center gap-0.5 rounded-lg bg-surface-hover/80 p-0.5">
        {MODES.map(({ id, icon: Glyph, key }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeMode === id}
            onClick={() => setActiveMode(id)}
            className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40', activeMode === id ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text')}
          ><Glyph className="size-3.5" aria-hidden="true" /><span className="max-md:sr-only">{t(key)}</span></button>
        ))}
      </nav>

      {(editing || activeMode === 'preview') ? (
        <div className="flex items-center gap-0.5" role="group" aria-label={t('st.toolbar.device')}>
          {DEVICES.map((id) => {
            const Glyph = DEVICE_ICON[id];
            return <IconButton key={id} label={t(`st.device.${id}` as 'st.device.desktop')} icon={<Glyph />} aria-pressed={device === id} variant={device === id ? 'secondary' : 'ghost'} onClick={() => setDevice(id)} />;
          })}
        </div>
      ) : null}

      {editing ? (
        <div className="flex items-center gap-0.5">
          <IconButton label={t('st.toolbar.undo')} icon={<ArrowCounterClockwise />} disabled={!canUndo} onClick={undo} />
          <IconButton label={t('st.toolbar.redo')} icon={<ArrowClockwise />} disabled={!canRedo} onClick={redo} />
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <Status tone={stateTone[state]} role="status" aria-live="polite">{t(`st.save.${state}` as 'st.save.saved')}</Status>
        <Button size="sm" variant="ghost" onClick={onValidate} loading={validating} aria-label={t('st.toolbar.check')} title={t('st.toolbar.check')}>
          {issues && issues.errors > 0 ? <WarningCircle className="text-error" aria-hidden="true" /> : <Check aria-hidden="true" />}
          <span className="max-lg:sr-only">{issues ? (issues.errors ? t('st.toolbar.errors', { n: issues.errors }) : issues.warnings ? t('st.toolbar.warnings', { n: issues.warnings }) : t('st.toolbar.healthy')) : t('st.toolbar.check')}</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => void saveNow()} disabled={saving || !isDirty} aria-label={t('st.toolbar.save')}>
          {saving ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <FloppyDisk aria-hidden="true" />}
          <span className="max-md:sr-only">{t('st.toolbar.save')}</span>
        </Button>
        <Button size="sm" variant="accent" onClick={onPublish}><ArrowUpRight aria-hidden="true" />{t('st.toolbar.publish')}</Button>
      </div>
    </header>
  );
}
