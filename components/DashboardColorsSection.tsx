// Owner-facing color picker for the gym's OWNER DASHBOARD colors. Lives
// in /owner/settings → Dashboard tab. Picks dashboard_primary_color and
// dashboard_accent_color on gym_themes (separate from the website's
// primary/accent so the dashboard can have its own look).
//
// Saving here updates the live dashboard on the next mount (or the next
// time OwnerLayout reloads its brand).

import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { ColorPickerField } from '@/components/ColorPicker';

type Row = {
  primary_color: string;
  accent_color: string;
  dashboard_primary_color: string | null;
  dashboard_accent_color: string | null;
};

export function DashboardColorsSection() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [row, setRow] = useState<Row | null>(null);
  const [draft, setDraft] = useState<{ primary: string; accent: string }>({ primary: '#7C3AED', accent: '#14B8A6' });
  const [usingWebsite, setUsingWebsite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const { data } = await supabase
      .from('gym_themes')
      .select('primary_color, accent_color, dashboard_primary_color, dashboard_accent_color')
      .eq('gym_id', gymId)
      .is('location_id', null)
      .maybeSingle();
    const r = (data as Row) ?? {
      primary_color: '#7C3AED', accent_color: '#14B8A6',
      dashboard_primary_color: null, dashboard_accent_color: null,
    };
    setRow(r);
    const isInherited = !r.dashboard_primary_color && !r.dashboard_accent_color;
    setUsingWebsite(isInherited);
    setDraft({
      primary: r.dashboard_primary_color ?? r.primary_color,
      accent: r.dashboard_accent_color ?? r.accent_color,
    });
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  async function save(next: { primary?: string | null; accent?: string | null }) {
    if (!gymId || !row) return;
    setErr(null);
    setSaving(true);
    const payload = {
      dashboard_primary_color: next.primary === null ? null : (next.primary ?? draft.primary),
      dashboard_accent_color: next.accent === null ? null : (next.accent ?? draft.accent),
    };
    const { error } = await supabase
      .from('gym_themes')
      .update(payload)
      .eq('gym_id', gymId)
      .is('location_id', null);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSavedAt(Date.now());
    load();
  }

  if (!gymId) {
    return <Text style={styles.dim}>Your account isn't linked to a gym yet.</Text>;
  }
  if (!row) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Dashboard colors</Text>
        <Text style={styles.sub}>
          These colors brand your owner dashboard and the inner pages inside
          it — they're separate from your public website colors so you can
          pick whatever feels right for your team. Active sub-tabs, primary
          buttons, and the sidebar all use these.
        </Text>
      </View>

      <View style={styles.inheritRow}>
        <Pressable
          style={[styles.inheritBtn, usingWebsite && styles.inheritBtnActive]}
          onPress={() => save({ primary: null, accent: null })}
          disabled={saving}
        >
          <Text style={[styles.inheritBtnText, usingWebsite && styles.inheritBtnTextActive]}>
            {usingWebsite ? '✓ Using website colors' : 'Use my website colors'}
          </Text>
        </Pressable>
        <Text style={styles.inheritHint}>
          Or pick separate dashboard colors below.
        </Text>
      </View>

      <View style={styles.row}>
        <ColorPickerField
          label="Dashboard primary"
          value={draft.primary}
          onChange={(v) => setDraft({ ...draft, primary: v })}
          onCommit={(v) => save({ primary: v })}
        />
        <ColorPickerField
          label="Dashboard accent"
          value={draft.accent}
          onChange={(v) => setDraft({ ...draft, accent: v })}
          onCommit={(v) => save({ accent: v })}
        />
      </View>

      <View style={[styles.preview, { backgroundColor: draft.primary }]}>
        <Text style={styles.previewLabel}>Live preview</Text>
        <View style={[styles.previewBtn, { backgroundColor: draft.accent }]}>
          <Text style={styles.previewBtnText}>Sample button</Text>
        </View>
        <Text style={styles.previewHint}>
          Sidebar = primary. Active tabs and CTAs = accent on dark, primary on light.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}
      {savedAt && !err ? <Text style={styles.saved}>Saved. Reload the page to see the change everywhere.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginTop: 4 },

  inheritRow: { gap: 6 },
  inheritBtn: {
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  inheritBtnActive: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
  inheritBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  inheritBtnTextActive: { color: '#047857' },
  inheritHint: { fontSize: 12, color: theme.colors.textSecondary },

  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },

  preview: {
    padding: 16, borderRadius: 12, gap: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  previewLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '800', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  previewBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  previewBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  previewHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },

  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },
  saved: { color: theme.colors.tealDark, fontWeight: '700', fontSize: 13 },
});
