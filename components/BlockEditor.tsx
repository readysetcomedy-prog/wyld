import { memo, useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import { WaiverBlock, newBlockId } from '@/lib/waiverTemplate';
import { blockTextStyle } from '@/components/WaiverBlocksView';

const COLOR_SWATCHES: (string | null)[] = [
  null,
  '#0F172A',
  '#475569',
  '#dc2626',
  '#ea580c',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
];

// Cross-platform rich-text editor. The waiver is an array of blocks; each
// block is a paragraph / heading / bullet with its own formatting. Tap a
// block to reveal its formatting toolbar.

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: WaiverBlock[];
  onChange: (b: WaiverBlock[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef(blocks);
  ref.current = blocks;

  const patch = useCallback(
    (id: string, p: Partial<WaiverBlock>) => {
      onChange(ref.current.map((b) => (b.id === id ? { ...b, ...p } : b)));
    },
    [onChange]
  );
  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      const arr = [...ref.current];
      const i = arr.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      onChange(arr);
    },
    [onChange]
  );
  const remove = useCallback(
    (id: string) => {
      onChange(ref.current.filter((b) => b.id !== id));
    },
    [onChange]
  );
  const addAfter = useCallback(
    (id: string | null) => {
      const arr = [...ref.current];
      const block: WaiverBlock = { id: newBlockId(), type: 'p', text: '' };
      const i = id ? arr.findIndex((b) => b.id === id) : arr.length - 1;
      arr.splice(i + 1, 0, block);
      onChange(arr);
      setActiveId(block.id);
    },
    [onChange]
  );

  return (
    <View style={styles.root}>
      {blocks.length === 0 ? (
        <Text style={styles.empty}>Empty. Add a block to start writing.</Text>
      ) : null}
      {blocks.map((b) => (
        <BlockRow
          key={b.id}
          block={b}
          active={activeId === b.id}
          onActivate={setActiveId}
          patch={patch}
          move={move}
          remove={remove}
          addAfter={addAfter}
        />
      ))}
      <Pressable style={styles.addBtn} onPress={() => addAfter(null)}>
        <Text style={styles.addBtnText}>+ Add block</Text>
      </Pressable>
    </View>
  );
}

const BlockRow = memo(function BlockRow({
  block,
  active,
  onActivate,
  patch,
  move,
  remove,
  addAfter,
}: {
  block: WaiverBlock;
  active: boolean;
  onActivate: (id: string) => void;
  patch: (id: string, p: Partial<WaiverBlock>) => void;
  move: (id: string, dir: -1 | 1) => void;
  remove: (id: string) => void;
  addAfter: (id: string) => void;
}) {
  const id = block.id;
  return (
    <View style={[styles.block, active && styles.blockActive]}>
      {active ? (
        <View style={styles.toolbar}>
          <Select
            value={block.type}
            onChange={(v) => patch(id, { type: v as WaiverBlock['type'] })}
            options={[
              { value: 'h2', label: 'Heading' },
              { value: 'h3', label: 'Subheading' },
              { value: 'p', label: 'Paragraph' },
              { value: 'bullet', label: 'Bullet' },
            ]}
            ariaLabel="Block type"
          />
          <Toggle label="B" on={!!block.bold} bold onPress={() => patch(id, { bold: !block.bold })} />
          <Toggle label="I" on={!!block.italic} italic onPress={() => patch(id, { italic: !block.italic })} />
          <Toggle
            label="U"
            on={!!block.underline}
            underline
            onPress={() => patch(id, { underline: !block.underline })}
          />
          <Toggle label="⯇" on={(block.align ?? 'left') === 'left'} onPress={() => patch(id, { align: 'left' })} />
          <Toggle label="≡" on={block.align === 'center'} onPress={() => patch(id, { align: 'center' })} />
          <Toggle label="⯈" on={block.align === 'right'} onPress={() => patch(id, { align: 'right' })} />
          <Select
            value={block.size ?? 'md'}
            onChange={(v) => patch(id, { size: v as WaiverBlock['size'] })}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Normal' },
              { value: 'lg', label: 'Large' },
            ]}
            ariaLabel="Text size"
          />
          <View style={styles.swatchRow}>
            {COLOR_SWATCHES.map((c, i) => {
              const sel = (block.color ?? null) === c;
              return (
                <Pressable
                  key={i}
                  onPress={() => patch(id, { color: c ?? undefined })}
                  style={[
                    styles.swatch,
                    { backgroundColor: c ?? '#fff' },
                    !c && styles.swatchDefault,
                    sel && styles.swatchSel,
                  ]}
                >
                  {!c ? <Text style={styles.swatchA}>A</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.spacer} />
          <Toggle label="↑" on={false} onPress={() => move(id, -1)} />
          <Toggle label="↓" on={false} onPress={() => move(id, 1)} />
          <Toggle label="✕" on={false} danger onPress={() => remove(id)} />
        </View>
      ) : null}

      <View style={block.type === 'bullet' ? styles.bulletRow : undefined}>
        {block.type === 'bullet' ? (
          <Text style={[blockTextStyle(block), { textAlign: 'left' }]}>{'•'}</Text>
        ) : null}
        <TextInput
          value={block.text}
          onChangeText={(t) => patch(id, { text: t })}
          onFocus={() => onActivate(id)}
          multiline
          placeholder={
            block.type === 'h2'
              ? 'Heading…'
              : block.type === 'h3'
              ? 'Subheading…'
              : 'Write here…'
          }
          placeholderTextColor="#94a3b8"
          style={[
            styles.input,
            blockTextStyle(block),
            block.type === 'bullet' && { flex: 1 },
          ]}
        />
      </View>

      {active ? (
        <Pressable style={styles.addInline} onPress={() => addAfter(id)}>
          <Text style={styles.addInlineText}>+ Add block below</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

function Toggle({
  label,
  on,
  onPress,
  bold,
  italic,
  underline,
  danger,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggle, on && styles.toggleOn, danger && styles.toggleDanger]}
    >
      <Text
        style={[
          styles.toggleText,
          on && styles.toggleTextOn,
          bold && { fontWeight: '900' },
          italic && { fontStyle: 'italic' },
          underline && { textDecorationLine: 'underline' },
          danger && { color: '#dc2626' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#fbfcfe',
  },
  empty: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic', padding: 8 },
  block: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 6,
    gap: 6,
  },
  blockActive: { borderColor: theme.colors.wyldPurple, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  toggle: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  toggleDanger: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  toggleText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  toggleTextOn: { color: '#fff' },
  swatchRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDefault: { borderColor: theme.colors.border },
  swatchSel: { borderWidth: 2, borderColor: theme.colors.wyldPurple },
  swatchA: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  spacer: { flex: 1, minWidth: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    minHeight: 40,
    textAlignVertical: 'top',
  },
  addInline: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 2 },
  addInlineText: { fontSize: 12, fontWeight: '700', color: theme.colors.wyldPurple },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.wyldPurple,
    marginTop: 2,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
