import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useGymTheme } from '@/lib/gymTheme';
import { WaiverRichEditor } from '@/components/WaiverRichEditor';
import {
  WaiverBlock,
  parseBlocks,
  premadeWaiverBlocks,
  PREMADE_WAIVER_TITLE,
} from '@/lib/waiverTemplate';

type Waiver = {
  id: string;
  gym_id: string;
  title: string;
  content: string;
  applies_to_all: boolean;
};
type Offering = { id: string; name: string };
type Sig = { id: string; participant_name: string; signed_at: string; member_id: string | null };

type Editing = {
  id?: string;
  title: string;
  blocks: WaiverBlock[];
  applies_to_all: boolean;
  offeringIds: string[];
};

export function WaiversManager({ gymId }: { gymId: string }) {
  const gymTheme = useGymTheme();
  const [waivers, setWaivers] = useState<Waiver[] | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sigsFor, setSigsFor] = useState<string | null>(null);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [sigsHasMore, setSigsHasMore] = useState(false);
  const [sigsLoading, setSigsLoading] = useState(false);
  const SIGS_PAGE = 100;

  const load = useCallback(async () => {
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase.from('gym_waivers').select('*').eq('gym_id', gymId).order('created_at'),
      supabase.from('gym_offerings').select('id, name').eq('gym_id', gymId).order('display_order'),
    ]);
    setWaivers((w as Waiver[]) ?? []);
    setOfferings((o as Offering[]) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  function openEditor(e: Editing) {
    setEditing(e);
    setEditorKey((k) => k + 1);
  }

  async function startEdit(w: Waiver) {
    const { data: links } = await supabase
      .from('gym_waiver_offerings')
      .select('offering_id')
      .eq('waiver_id', w.id);
    openEditor({
      id: w.id,
      title: w.title,
      blocks: parseBlocks(w.content),
      applies_to_all: w.applies_to_all,
      offeringIds: (links ?? []).map((l: any) => l.offering_id),
    });
  }

  async function save() {
    if (!editing) return;
    setErr(null);
    if (!editing.title.trim()) {
      setErr('Give the waiver a title.');
      return;
    }
    setSaving(true);
    const payload = {
      gym_id: gymId,
      title: editing.title.trim(),
      content: JSON.stringify(editing.blocks),
      applies_to_all: editing.applies_to_all,
    };
    let waiverId = editing.id;
    if (waiverId) {
      const { error } = await supabase.from('gym_waivers').update(payload).eq('id', waiverId);
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('gym_waivers')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
      waiverId = (data as any).id;
    }
    // Sync offering attachments.
    await supabase.from('gym_waiver_offerings').delete().eq('waiver_id', waiverId);
    if (!editing.applies_to_all && editing.offeringIds.length > 0) {
      await supabase.from('gym_waiver_offerings').insert(
        editing.offeringIds.map((oid) => ({ waiver_id: waiverId, offering_id: oid }))
      );
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this waiver?')) return;
    const { error } = await supabase.from('gym_waivers').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(null);
    load();
  }

  async function viewSigs(waiverId: string) {
    if (sigsFor === waiverId) {
      setSigsFor(null);
      return;
    }
    setSigsLoading(true);
    const { data } = await supabase
      .from('gym_waiver_signatures')
      .select('id, participant_name, signed_at, member_id')
      .eq('waiver_id', waiverId)
      .order('signed_at', { ascending: false })
      .range(0, SIGS_PAGE);
    const rows = ((data as Sig[]) ?? []);
    setSigs(rows.slice(0, SIGS_PAGE));
    setSigsHasMore(rows.length > SIGS_PAGE);
    setSigsFor(waiverId);
    setSigsLoading(false);
  }

  async function loadMoreSigs() {
    if (!sigsFor || sigsLoading || !sigsHasMore) return;
    setSigsLoading(true);
    const from = sigs.length;
    const to = from + SIGS_PAGE;
    const { data } = await supabase
      .from('gym_waiver_signatures')
      .select('id, participant_name, signed_at, member_id')
      .eq('waiver_id', sigsFor)
      .order('signed_at', { ascending: false })
      .range(from, to);
    const rows = ((data as Sig[]) ?? []);
    setSigs((prev) => [...prev, ...rows.slice(0, SIGS_PAGE)]);
    setSigsHasMore(rows.length > SIGS_PAGE);
    setSigsLoading(false);
  }

  if (waivers === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <View style={styles.root}>
      <Text style={styles.sub}>
        Build waivers members sign before joining. Attach a waiver to specific offerings,
        or apply it to all of them. Every waiver gets a signature block at the bottom.
      </Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {!editing ? (
        <View style={styles.topButtons}>
          <Pressable
            style={[styles.btn, { backgroundColor: gymTheme.accent }]}
            onPress={() =>
              openEditor({ title: '', blocks: [], applies_to_all: true, offeringIds: [] })
            }
          >
            <Text style={styles.btnText}>+ New waiver</Text>
          </Pressable>
          <Pressable
            style={[styles.btnOutline, { borderColor: gymTheme.accent }]}
            onPress={() =>
              openEditor({
                title: PREMADE_WAIVER_TITLE,
                blocks: premadeWaiverBlocks(),
                applies_to_all: true,
                offeringIds: [],
              })
            }
          >
            <Text style={[styles.btnOutlineText, { color: gymTheme.accent }]}>Use Premade Template</Text>
          </Pressable>
        </View>
      ) : null}

      {editing ? (
        <View style={styles.editorCard}>
          <Text style={styles.label}>Waiver title</Text>
          <TextInput
            value={editing.title}
            onChangeText={(v) => setEditing({ ...editing, title: v })}
            placeholder="Liability Waiver"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.label}>Waiver text</Text>
          <WaiverRichEditor
            key={editorKey}
            blocks={editing.blocks}
            onChange={(blocks) => setEditing((e) => (e ? { ...e, blocks } : e))}
          />

          <Text style={styles.label}>Applies to</Text>
          <View style={styles.radioRow}>
            <Pressable
              style={styles.radio}
              onPress={() => setEditing({ ...editing, applies_to_all: true })}
            >
              <View style={[
                styles.radioDot,
                editing.applies_to_all && { borderColor: gymTheme.accent, backgroundColor: gymTheme.accent },
              ]} />
              <Text style={styles.radioText}>All offerings</Text>
            </Pressable>
            <Pressable
              style={styles.radio}
              onPress={() => setEditing({ ...editing, applies_to_all: false })}
            >
              <View style={[
                styles.radioDot,
                !editing.applies_to_all && { borderColor: gymTheme.accent, backgroundColor: gymTheme.accent },
              ]} />
              <Text style={styles.radioText}>Specific offerings</Text>
            </Pressable>
          </View>

          {!editing.applies_to_all ? (
            offerings.length === 0 ? (
              <Text style={styles.dim}>
                No offerings yet — add some in the Offerings tab to attach this waiver to them.
              </Text>
            ) : (
              <View style={styles.checkList}>
                {offerings.map((o) => {
                  const on = editing.offeringIds.includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      style={styles.checkRow}
                      onPress={() =>
                        setEditing({
                          ...editing,
                          offeringIds: on
                            ? editing.offeringIds.filter((x) => x !== o.id)
                            : [...editing.offeringIds, o.id],
                        })
                      }
                    >
                      <View style={[
                        styles.checkBox,
                        on && { backgroundColor: gymTheme.accent, borderColor: gymTheme.accent },
                      ]}>
                        {on ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
                      <Text style={styles.checkLabel}>{o.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )
          ) : null}

          <View style={styles.editorButtons}>
            <Pressable style={[styles.btn, { backgroundColor: gymTheme.accent }]} onPress={save} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save waiver'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setEditing(null)}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            {editing.id ? (
              <Pressable style={styles.btnDanger} onPress={() => remove(editing.id!)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!editing ? (
        waivers.length === 0 ? (
          <Text style={styles.dim}>No waivers yet.</Text>
        ) : (
          <View style={styles.list}>
            {waivers.map((w) => (
              <View key={w.id} style={styles.waiverCard}>
                <View style={styles.waiverRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waiverTitle}>{w.title}</Text>
                    <Text style={styles.waiverMeta}>
                      {w.applies_to_all ? 'Applies to all offerings' : 'Specific offerings'}
                    </Text>
                  </View>
                  <Pressable style={styles.smallBtn} onPress={() => viewSigs(w.id)}>
                    <Text style={styles.smallBtnText}>
                      {sigsFor === w.id ? 'Hide signed' : 'Signed'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.smallBtn} onPress={() => startEdit(w)}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                </View>
                {sigsFor === w.id ? (
                  <View style={styles.sigList}>
                    {sigs.length === 0 && !sigsLoading ? (
                      <Text style={styles.dim}>No one has signed this waiver yet.</Text>
                    ) : (
                      <>
                        {sigs.map((s) => (
                          <Text key={s.id} style={styles.sigRow}>
                            {s.participant_name} — {new Date(s.signed_at).toLocaleDateString()}
                          </Text>
                        ))}
                        {sigsHasMore ? (
                          <Pressable
                            style={styles.smallBtn}
                            disabled={sigsLoading}
                            onPress={loadMoreSigs}
                          >
                            <Text style={styles.smallBtnText}>
                              {sigsLoading ? 'Loading…' : 'Load more'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },

  topButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnOutline: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.wyldPurple,
    backgroundColor: '#fff',
  },
  btnOutlineText: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
  btnDanger: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  btnDangerText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },

  editorCard: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  radioRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  radioDotOn: {
    borderColor: theme.colors.wyldPurple,
    backgroundColor: theme.colors.wyldPurple,
  },
  radioText: { fontSize: 14, fontWeight: '600', color: theme.colors.charcoal },
  checkList: { gap: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  checkLabel: { fontSize: 14, color: theme.colors.charcoal },
  editorButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },

  list: { gap: 10 },
  waiverCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  waiverRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waiverTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  waiverMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  sigList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    gap: 3,
  },
  sigRow: { fontSize: 13, color: theme.colors.textSecondary },
});
