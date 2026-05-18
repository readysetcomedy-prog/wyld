import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { theme } from '@/lib/theme';
import { WaiverBlock, WaiverRun, newBlockId } from '@/lib/waiverTemplate';

// ---------------------------------------------------------------------------
// Block model <-> HTML. The editor is web-only, so serialization uses the
// real browser DOM — no hand-rolled HTML parsing.
// ---------------------------------------------------------------------------

const SIZE_PX: Record<string, number> = { sm: 12, md: 15, lg: 19, xl: 26 };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function runToHtml(r: WaiverRun): string {
  let h = esc(r.text).replace(/\n/g, '<br>');
  const css: string[] = [];
  if (r.color) css.push(`color:${r.color}`);
  if (r.size) css.push(`font-size:${SIZE_PX[r.size]}px`);
  if (css.length) h = `<span style="${css.join(';')}">${h}</span>`;
  if (r.bold) h = `<b>${h}</b>`;
  if (r.italic) h = `<i>${h}</i>`;
  if (r.underline) h = `<u>${h}</u>`;
  return h;
}

function blocksToHtml(blocks: WaiverBlock[]): string {
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'bullet') {
      let lis = '';
      while (i < blocks.length && blocks[i].type === 'bullet') {
        const bb = blocks[i];
        const al = bb.align ? ` style="text-align:${bb.align}"` : '';
        lis += `<li${al}>${bb.runs.map(runToHtml).join('') || '<br>'}</li>`;
        i += 1;
      }
      html += `<ul>${lis}</ul>`;
      continue;
    }
    const tag = b.type === 'h2' ? 'h2' : b.type === 'h3' ? 'h3' : 'p';
    const al = b.align ? ` style="text-align:${b.align}"` : '';
    html += `<${tag}${al}>${b.runs.map(runToHtml).join('') || '<br>'}</${tag}>`;
    i += 1;
  }
  return html || '<p><br></p>';
}

function rgbToHex(c: string): string {
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return c;
  const hx = (n: string) => parseInt(n, 10).toString(16).padStart(2, '0');
  return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
}

function pxToSize(px: number): WaiverRun['size'] {
  if (px <= 13) return 'sm';
  if (px <= 16) return undefined;
  if (px <= 22) return 'lg';
  return 'xl';
}

function fontAttrToSize(v: string): WaiverRun['size'] {
  const n = parseInt(v, 10);
  if (n <= 2) return 'sm';
  if (n <= 4) return undefined;
  if (n === 5) return 'lg';
  return 'xl';
}

type Ctx = Omit<WaiverRun, 'text'>;

function collectRuns(node: Node, ctx: Ctx, out: WaiverRun[]): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const t = child.textContent || '';
      if (t) out.push({ text: t, ...ctx });
      return;
    }
    if (child.nodeType !== 1) return;
    const el = child as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      out.push({ text: '\n', ...ctx });
      return;
    }
    const next: Ctx = { ...ctx };
    if (tag === 'B' || tag === 'STRONG') next.bold = true;
    if (tag === 'I' || tag === 'EM') next.italic = true;
    if (tag === 'U') next.underline = true;
    if (tag === 'FONT') {
      const c = el.getAttribute('color');
      if (c) next.color = c.startsWith('rgb') ? rgbToHex(c) : c;
      const s = el.getAttribute('size');
      if (s) next.size = fontAttrToSize(s);
    }
    const st = el.style;
    if (st.fontWeight === 'bold' || parseInt(st.fontWeight, 10) >= 600) next.bold = true;
    if (st.fontStyle === 'italic') next.italic = true;
    if ((st.textDecorationLine || st.textDecoration || '').includes('underline')) {
      next.underline = true;
    }
    if (st.color) next.color = st.color.startsWith('rgb') ? rgbToHex(st.color) : st.color;
    if (st.fontSize) {
      const px = parseFloat(st.fontSize);
      if (px) next.size = pxToSize(px);
    }
    collectRuns(el, next, out);
  });
}

function mergeRuns(runs: WaiverRun[]): WaiverRun[] {
  const out: WaiverRun[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (
      last &&
      !!last.bold === !!r.bold &&
      !!last.italic === !!r.italic &&
      !!last.underline === !!r.underline &&
      last.color === r.color &&
      last.size === r.size
    ) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

function elementToBlock(el: HTMLElement, type: WaiverBlock['type']): WaiverBlock {
  const collected: WaiverRun[] = [];
  collectRuns(el, {}, collected);
  let runs = mergeRuns(collected);
  if (runs.length === 0) runs = [{ text: '' }];
  const al = el.style.textAlign;
  const align = al === 'center' || al === 'right' || al === 'left' ? al : undefined;
  return { id: newBlockId(), type, align, runs };
}

function htmlToBlocks(root: HTMLElement): WaiverBlock[] {
  const blocks: WaiverBlock[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const t = node.textContent || '';
      if (t.trim()) blocks.push({ id: newBlockId(), type: 'p', runs: [{ text: t }] });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'UL' || tag === 'OL') {
      Array.from(el.children)
        .filter((c) => c.tagName === 'LI')
        .forEach((li) => blocks.push(elementToBlock(li as HTMLElement, 'bullet')));
      return;
    }
    const type: WaiverBlock['type'] =
      tag === 'H1' || tag === 'H2'
        ? 'h2'
        : tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6'
        ? 'h3'
        : 'p';
    blocks.push(elementToBlock(el, type));
  });
  return blocks.length ? blocks : [{ id: newBlockId(), type: 'p', runs: [{ text: '' }] }];
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const COLORS = ['#0F172A', '#64748B', '#DC2626', '#EA580C', '#16A34A', '#2563EB', '#7C3AED'];

export function WaiverRichEditor({
  blocks,
  onChange,
}: {
  blocks: WaiverBlock[];
  onChange: (blocks: WaiverBlock[]) => void;
}) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.nativeText}>
          Waivers are built from the web dashboard. Open this gym on the web to edit
          waiver text.
        </Text>
      </View>
    );
  }
  return <WebEditor blocks={blocks} onChange={onChange} />;
}

function WebEditor({
  blocks,
  onChange,
}: {
  blocks: WaiverBlock[];
  onChange: (blocks: WaiverBlock[]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    if (ref.current && !ready.current) {
      ready.current = true;
      ref.current.innerHTML = blocksToHtml(blocks);
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch {
        /* not supported — fine */
      }
    }
  }, [blocks]);

  const sync = () => {
    if (ref.current) onChange(htmlToBlocks(ref.current));
  };

  const cmd = (command: string, value?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* ignore */
    }
    sync();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <TBtn label="Body" onPress={() => cmd('formatBlock', '<p>')} />
        <TBtn label="Heading" onPress={() => cmd('formatBlock', '<h2>')} />
        <TBtn label="Subhead" onPress={() => cmd('formatBlock', '<h3>')} />
        <TBtn label="• List" onPress={() => cmd('insertUnorderedList')} />
        <Divider />
        <TBtn label="B" bold onPress={() => cmd('bold')} />
        <TBtn label="I" italic onPress={() => cmd('italic')} />
        <TBtn label="U" underline onPress={() => cmd('underline')} />
        <Divider />
        <TBtn label="S" onPress={() => cmd('fontSize', '2')} />
        <TBtn label="M" onPress={() => cmd('fontSize', '3')} />
        <TBtn label="L" onPress={() => cmd('fontSize', '5')} />
        <TBtn label="XL" onPress={() => cmd('fontSize', '7')} />
        <Divider />
        <TBtn label="Left" onPress={() => cmd('justifyLeft')} />
        <TBtn label="Center" onPress={() => cmd('justifyCenter')} />
        <TBtn label="Right" onPress={() => cmd('justifyRight')} />
        <Divider />
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => cmd('foreColor', c)}
            style={[styles.swatch, { backgroundColor: c }]}
            accessibilityLabel={`Text color ${c}`}
          />
        ))}
      </View>

      {React.createElement('div', {
        ref,
        contentEditable: true,
        suppressContentEditableWarning: true,
        onInput: sync,
        onBlur: sync,
        spellCheck: true,
        style: {
          minHeight: 320,
          maxHeight: 520,
          overflowY: 'auto',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 15,
          lineHeight: 1.6,
          color: theme.colors.charcoal,
          backgroundColor: '#fff',
          outline: 'none',
        },
      })}

      <Text style={styles.hint}>
        Select text, then use the toolbar to format it — bold, size, color, and
        alignment.
      </Text>
    </View>
  );
}

function TBtn({
  label,
  onPress,
  bold,
  italic,
  underline,
}: {
  label: string;
  onPress: () => void;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tbtn}>
      <Text
        style={[
          styles.tbtnText,
          bold && { fontWeight: '900' },
          italic && { fontStyle: 'italic' },
          underline && { textDecorationLine: 'underline' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  tbtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  tbtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
    marginHorizontal: 2,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
  },
  hint: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  nativeFallback: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  nativeText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21 },
});
