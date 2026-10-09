import { useId, type ReactNode } from 'react';
import { Info } from '@phosphor-icons/react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Property controls for the Studio inspector. Each property gets the control that fits it (select, segmented, slider,
// numeric, toggle, color) rather than a text box; all are native elements so keyboard and assistive tech work as-is.

const control = 'h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-text outline-none transition-colors focus:border-accent';

export function Field({ label, help, htmlFor, children }: { label: string; help?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label htmlFor={htmlFor} className="text-[11px] font-medium text-text-secondary">{label}</label>
        {help ? <Tooltip label={help}><span tabIndex={0} aria-label={help} className="inline-flex text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"><Info className="size-3" aria-hidden="true" /></span></Tooltip> : null}
      </div>
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, help, placeholder, maxLength, mono }: { label: string; value: string; onChange: (value: string) => void; help?: string; placeholder?: string; maxLength?: number; mono?: boolean }) {
  const id = useId();
  return <Field label={label} help={help} htmlFor={id}><input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className={cn(control, mono && 'font-mono')} /></Field>;
}

export function SelectField<T extends string>({ label, value, options, onChange, help, disabled }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void; help?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)} className={control}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}

export function SegmentedField<T extends string | number>({ label, value, options, onChange, help }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (value: T) => void; help?: string }) {
  const id = useId();
  return (
    <Field label={label} help={help}>
      <div role="radiogroup" aria-labelledby={id} className="flex rounded-md border border-border bg-background p-0.5">
        <span id={id} className="sr-only">{label}</span>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn('h-6 flex-1 rounded px-1.5 text-[11px] font-medium transition-colors', option.value === value ? 'bg-accent text-white' : 'text-text-muted hover:text-text')}
          >{option.label}</button>
        ))}
      </div>
    </Field>
  );
}

export function ToggleField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (value: boolean) => void; help?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <span id={id} className="text-[11px] font-medium text-text-secondary">{label}</span>
        {help ? <Tooltip label={help}><span tabIndex={0} aria-label={help} className="inline-flex rounded text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><Info className="size-3" aria-hidden="true" /></span></Tooltip> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40', checked ? 'bg-accent' : 'bg-surface-active')}
      ><span className={cn('absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} /></button>
    </div>
  );
}

export function NumberField({ label, value, min, max, step = 1, onChange, help, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; help?: string; suffix?: string }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(event) => { const next = Number(event.target.value); if (event.target.value !== '' && Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next)))); }}
          className={cn(control, suffix && 'pr-8')}
        />
        {suffix ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">{suffix}</span> : null}
      </div>
    </Field>
  );
}

export function SliderField({ label, value, min, max, step = 1, onChange, help, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; help?: string; suffix?: string }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-(--color-accent)" />
        <span className="w-12 shrink-0 text-right font-mono text-[11px] text-text-secondary">{value}{suffix ?? ''}</span>
      </div>
    </Field>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;
export function ColorField({ label, value, onChange, onClear, help, clearLabel }: { label: string; value: string | undefined; onChange: (value: string) => void; onClear: () => void; help?: string; clearLabel: string }) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value && HEX.test(value) ? value.slice(0, 7) : '#6366f1'} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-secondary">{value ?? '—'}</span>
        {value ? <button type="button" onClick={onClear} className="shrink-0 rounded px-1.5 py-1 text-[11px] text-text-muted hover:bg-surface-hover hover:text-text">{clearLabel}</button> : null}
      </div>
    </Field>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="space-y-3 border-b border-border pb-4 last:border-b-0">{title ? <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</h4> : null}{children}</div>;
}
