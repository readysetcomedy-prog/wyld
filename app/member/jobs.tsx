import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

type Posting = {
  id: string;
  gym_id: string;
  title: string;
  role_id: string | null;
  location_id: string | null;
  description: string | null;
  employment_type: string | null;
  compensation: string | null;
  created_at: string;
  gym: { id: string; name: string; slug: string | null; city: string | null; state: string | null };
  role_name: string | null;
  location_label: string | null;
};

export default function MemberJobs() {
  const { session, profile } = useAuth();
  const [postings, setPostings] = useState<Posting[] | null>(null);
  const [appliedTo, setAppliedTo] = useState<Set<string>>(new Set());
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submittedJustNow, setSubmittedJustNow] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: postingRows } = await supabase
      .from('gym_job_postings')
      .select(
        'id, gym_id, title, role_id, location_id, description, employment_type, compensation, created_at, gym:gyms(id, name, slug, city, state)'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    const rows = ((postingRows as any) ?? []) as Posting[];

    // Resolve role names and location labels in batch.
    const roleIds = Array.from(new Set(rows.map((r) => r.role_id).filter(Boolean))) as string[];
    const locIds = Array.from(new Set(rows.map((r) => r.location_id).filter(Boolean))) as string[];
    const roleMap = new Map<string, string>();
    const locMap = new Map<string, string>();
    if (roleIds.length) {
      const { data: rs } = await supabase
        .from('gym_roles')
        .select('id, name')
        .in('id', roleIds);
      ((rs as any) ?? []).forEach((r: any) => roleMap.set(r.id, r.name));
    }
    if (locIds.length) {
      const { data: ls } = await supabase
        .from('gym_locations')
        .select('id, label')
        .in('id', locIds);
      ((ls as any) ?? []).forEach((l: any) => locMap.set(l.id, l.label));
    }
    rows.forEach((r) => {
      r.role_name = r.role_id ? roleMap.get(r.role_id) ?? null : null;
      r.location_label = r.location_id ? locMap.get(r.location_id) ?? null : null;
    });
    setPostings(rows);

    if (session?.user) {
      const [{ data: apps }, { data: mems }] = [
        await supabase
          .from('gym_job_applications')
          .select('posting_id')
          .eq('user_id', session.user.id),
        await supabase
          .from('gym_memberships')
          .select('gym_id')
          .eq('member_id', session.user.id),
      ];
      setAppliedTo(new Set(((apps as any) ?? []).map((a: any) => a.posting_id)));
      setMemberOf(new Set(((mems as any) ?? []).map((m: any) => m.gym_id)));
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!postings) return [];
    const q = search.trim().toLowerCase();
    if (!q) return postings;
    return postings.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.role_name ?? '').toLowerCase().includes(q) ||
        p.gym.name.toLowerCase().includes(q) ||
        (p.gym.city ?? '').toLowerCase().includes(q) ||
        (p.gym.state ?? '').toLowerCase().includes(q) ||
        (p.employment_type ?? '').toLowerCase().includes(q)
    );
  }, [postings, search]);

  async function apply(p: Posting) {
    if (!session?.user || !profile) return;
    setSubmitErr(null);
    setSubmitting(true);
    const { error } = await supabase.from('gym_job_applications').insert({
      posting_id: p.id,
      full_name: profile.full_name || profile.email,
      email: profile.email.toLowerCase(),
      cover_note: coverNote.trim() || null,
      user_id: session.user.id,
    });
    if (error) {
      setSubmitting(false);
      setSubmitErr(error.message);
      return;
    }
    // Auto-join the gym as a member if not already one.
    if (!memberOf.has(p.gym_id)) {
      const { error: memErr } = await supabase
        .from('gym_memberships')
        .insert({ member_id: session.user.id, gym_id: p.gym_id, status: 'active' });
      // Ignore conflict-style errors silently (race conditions / pre-existing).
      if (memErr && !/duplicate|conflict/i.test(memErr.message)) {
        // surface only non-conflict failures
        setSubmitErr(`Application sent, but auto-join failed: ${memErr.message}`);
      } else {
        setMemberOf(new Set(memberOf).add(p.gym_id));
      }
    }
    setSubmitting(false);
    setAppliedTo(new Set(appliedTo).add(p.id));
    setSubmittedJustNow(p.id);
    setOpenCard(null);
    setCoverNote('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Open jobs</Text>
      <Text style={styles.sub}>
        Job postings across every gym on WyLD. Applying auto-joins you as a member of
        that gym so the owner can manage your application.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by gym, role, title, or city…"
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />

      {postings === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No open jobs match.</Text>
          <Text style={styles.emptyBody}>
            Try clearing your search, or check back later — gyms post new openings here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((p) => {
            const expanded = openCard === p.id;
            const applied = appliedTo.has(p.id);
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{p.title}</Text>
                    <Text style={styles.cardGym}>
                      {p.gym.name}
                      {p.gym.city ? ` · ${p.gym.city}` : ''}
                      {p.gym.state ? `, ${p.gym.state}` : ''}
                    </Text>
                  </View>
                  {applied || submittedJustNow === p.id ? (
                    <View style={styles.appliedBadge}>
                      <Text style={styles.appliedText}>Applied</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.chips}>
                  {p.role_name ? <Chip label={p.role_name} /> : null}
                  {p.location_label ? <Chip label={p.location_label} /> : null}
                  {p.employment_type ? <Chip label={p.employment_type} /> : null}
                  {p.compensation ? <Chip label={p.compensation} /> : null}
                </View>

                {p.description ? (
                  <Text style={styles.body}>{p.description}</Text>
                ) : null}

                {applied || submittedJustNow === p.id ? (
                  <Text style={styles.successHint}>
                    Application sent. The gym&apos;s owner will be in touch.
                  </Text>
                ) : expanded ? (
                  <View style={styles.form}>
                    <Text style={styles.formLabel}>Cover note (optional)</Text>
                    <TextInput
                      value={coverNote}
                      onChangeText={setCoverNote}
                      placeholder="Tell them why you'd be a great fit…"
                      placeholderTextColor="#94a3b8"
                      multiline
                      style={styles.textArea}
                    />
                    {submitErr ? <Text style={styles.err}>{submitErr}</Text> : null}
                    <View style={styles.formRow}>
                      <Pressable
                        onPress={() => {
                          setOpenCard(null);
                          setCoverNote('');
                          setSubmitErr(null);
                        }}
                        style={styles.btnGhost}
                      >
                        <Text style={styles.btnGhostText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => apply(p)}
                        disabled={submitting}
                        style={styles.btnPrimary}
                      >
                        <Text style={styles.btnPrimaryText}>
                          {submitting ? 'Sending…' : 'Submit application'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setOpenCard(p.id);
                      setSubmitErr(null);
                    }}
                    style={styles.btnPrimary}
                  >
                    <Text style={styles.btnPrimaryText}>Apply</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, maxWidth: 880 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  empty: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 520 },
  list: { gap: theme.spacing.sm },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  cardGym: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  appliedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.tealDark,
  },
  appliedText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: { fontSize: 12, color: theme.colors.charcoal, fontWeight: '600' },
  body: { fontSize: 14, color: theme.colors.charcoal, lineHeight: 21 },
  successHint: { fontSize: 13, color: theme.colors.tealDark, fontWeight: '600' },
  form: { gap: 8 },
  formLabel: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700' },
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 100,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
    textAlignVertical: 'top',
  },
  formRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnPrimary: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
  err: { color: theme.colors.danger, fontSize: 13 },
});
