import { Image as ImageGlyph } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Block } from './model';

/** Plain-text blocks (statement, reference text, explanation). Text is rendered as text: nothing is interpreted as markup. */
export function Blocks({ blocks, className }: { blocks: readonly Block[]; className?: string }) {
  return (
    <div className={cn('space-y-3 text-[15px] leading-7 text-text [overflow-wrap:anywhere]', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'paragraph') return <p key={index} className="whitespace-pre-line">{block.text}</p>;
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return <Tag key={index} className={cn('space-y-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</Tag>;
        }
        if (block.type === 'table') {
          return (
            <div key={index} className="max-w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-max border-collapse text-left text-sm">
                <thead><tr>{block.header.map((cell, i) => <th key={i} className="border-b border-border bg-surface-hover px-3 py-2 font-semibold">{cell}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="border-b border-border px-3 py-2 last:border-0">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        // Images are managed assets; the text alternative is always available.
        return <figure key={index} className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-text-secondary"><ImageGlyph className="size-5 shrink-0" aria-hidden />{block.alt}{block.caption ? <figcaption className="text-xs text-text-muted">{block.caption}</figcaption> : null}</figure>;
      })}
    </div>
  );
}
