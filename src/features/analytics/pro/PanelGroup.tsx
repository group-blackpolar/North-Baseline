import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useElementSize } from '../cellFill';
import { localizedText } from './format';

type Props = Record<string, unknown>;
type Item = { componentId: string; label: string; weight: number };

const items = (props: Props, locales: string[]): Item[] => (Array.isArray(props.items) ? props.items : []).flatMap((raw): Item[] => {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Props;
  return typeof item.componentId === 'string' ? [{ componentId: item.componentId, label: localizedText(item.label, locales) || item.componentId, weight: typeof item.weight === 'number' ? item.weight : 1 }] : [];
});

/**
 * A set of sibling components that share one region. When the region is tall enough for every member to keep its minimum height they
 * are stacked (heights proportional to their weights, so a map can outweigh a legend); otherwise one member is shown at a time behind
 * tabs, each using the whole region. Either way nothing scrolls and nothing is squeezed below a legible size.
 * Decided from the MEASURED size of the region, never from the screen size, so it also reacts to a resized window or panel.
 */
export function PanelGroup({ props, locales, render }: { props: Props; locales: string[]; render: (componentId: string) => ReactNode }) {
  const members = items(props, locales);
  const minHeight = typeof props.minItemHeight === 'number' ? props.minItemHeight : 190;
  const [box, size] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const GAP = 8;
  // Every member must keep `minItemHeight` at ITS share of the height, so the lightest member decides how tall the region has to be.
  const totalWeight = members.reduce((sum, member) => sum + member.weight, 0);
  const lightest = Math.min(...members.map((member) => member.weight));
  const stacked = size.height > 0 && size.height - (members.length - 1) * GAP >= (minHeight * totalWeight) / lightest;
  const current = members[Math.min(active, members.length - 1)];
  return (
    <div ref={box} className="flex h-full min-h-0 flex-col gap-2">
      {size.height === 0 ? null : stacked ? (
        members.map((member) => <div key={member.componentId} className="flex min-h-0 min-w-0 flex-col" style={{ flex: `${member.weight} 1 0%` }}>{render(member.componentId)}</div>)
      ) : (
        <>
          <div role="tablist" aria-label={localizedText(props.title, locales) || undefined} className="flex shrink-0 gap-1 rounded-lg bg-surface-hover p-0.5">
            {members.map((member, index) => (
              <button key={member.componentId} type="button" role="tab" aria-selected={index === active} onClick={() => setActive(index)}
                className={cn('min-w-0 flex-1 truncate rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40', index === active ? 'bg-surface text-text shadow-xs' : 'text-text-secondary hover:text-text')}>{member.label}</button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col">{current ? render(current.componentId) : null}</div>
        </>
      )}
    </div>
  );
}
