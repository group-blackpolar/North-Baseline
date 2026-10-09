// Tiny, safe renderer model for assistant replies. It never produces HTML: only a structure that React renders as text nodes,
// so model output (or content echoed from a tool) can never inject markup, links or images. Unit-tested with `node --test`.

export type Inline = { kind: 'text' | 'bold' | 'code'; value: string };
export type Block = { kind: 'p'; inlines: Inline[] } | { kind: 'ul' | 'ol'; items: Inline[][] };

/** `**bold**` and `` `code` `` only; everything else (including `<tags>` and `[links](x)`) stays literal text. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > last) out.push({ kind: 'text', value: source.slice(last, match.index) });
    out.push(match[1] !== undefined ? { kind: 'bold', value: match[1] } : { kind: 'code', value: match[2]! });
    last = match.index + match[0].length;
  }
  if (last < source.length) out.push({ kind: 'text', value: source.slice(last) });
  return out;
}

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: Inline[][] } | null = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push({ kind: 'p', inlines: parseInline(paragraph.join('\n')) }); paragraph = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? 'ul' : 'ol';
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]!));
    } else if (line.trim() === '') { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  return blocks;
}
