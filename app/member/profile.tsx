// The member's cross-gym personal profile. Avatar (used in messages and in
// per-gym employee profiles), name, and a list of every gym they belong to
// with status indicators (membership / waivers / employment). Tapping a
// gym row opens that gym's dashboard at /m/[gymId].

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

type GymRow = {
  membership_id: string;
  gym_id: string;
  gym_name: string;
  gym_slug: string | null;
  status: string;
  joined_at: string;
  waivers_total: number;
  waivers_signed: number;
  is_employee: boolean;
  employee_position: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: '#15803D',
  paused: '#B45309',
  cancelled: theme.colors.danger,
};

export default function MemberProfile() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(profile?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<GymRow[] | null>(null);

  useEffect(() => { setName(profile?.full_name ?? ''); }, [profile?.full_name]);

  const loadGyms = useCallback(async () => {
    if (!session?.user.id) return;
    // Pull memberships + (separately) every waiver and employee row that
    // mentions this user so we can roll up per-gym status.
    const [{ data: mems }, { data: emps }, { data: sigs }] = await Promise.all([
      supabase
        .from('gym_memberships')
        .select('id, status, joined_at, gym:gyms(id, name, slug)')
        .eq('member_id', session.user.id)
        .order('joined_at', { ascending: false }),
      supabase
        .from('gym_employees')
        .select('gym_id, position, terminate_date')
        .or(`user_id.eq.${session.user.id},email.eq.${profile?.email ?? ''}`),
      supabase
        .from('gym_waiver_signatures')
        .select('waiver_id, gym_id')
        .eq('member_id', session.user.id),
    ]);
    const gymIds = ((mems as any[]) ?? []).map((m) => m.gym?.id).filter(Boolean);
    const { data: waivers } = gymIds.length === 0
      ? { data: [] }
      : await supabase
          .from('gym_waivers')
          .select('id, gym_id')
          .eq('is_active', true)
          .in('gym_id', gymIds);

    const today = new Date().toISOString().slice(0, 10);
    const empByGym = new Map<string, { position: string | null; active: boolean }>();
    ((emps as any[]) ?? []).forEach((e) => {
      const active = !e.terminate_date || e.terminate_date > today;
      // Keep the most "active" record per gym.
      const prev = empByGym.get(e.gym_id);
      if (!prev || (active && !prev.active)) empByGym.set(e.gym_id, { position: e.position, active });
    });
    const waiverTotals = new Map<string, number>();
    ((waivers as any[]) ?? []).forEach((w) => waiverTotals.set(w.gym_id, (waiverTotals.get(w.gym_id) ?? 0) + 1));
    const sigCounts = new Map<string, number>();
    ((sigs as any[]) ?? []).forEach((s) => sigCounts.set(s.gym_id, (sigCounts.get(s.gym_id) ?? 0) + 1));

    setRows(((mems as any[]) ?? []).map((m) => {
      const emp = empByGym.get(m.gym.id);
      return {
        membership_id: m.id,
        gym_id: m.gym.id,
        gym_name: m.gym.name,
        gym_slug: m.gym.slug,
        status: m.status,
        joined_at: m.joined_at,
        waivers_total: waiverTotals.get(m.gym.id) ?? 0,
        waivers_signed: sigCounts.get(m.gym.id) ?? 0,
        is_employee: !!emp?.active,
        employee_position: emp?.active ? emp.position : null,
      };
    }));
  }, [session?.user.id, profile?.email]);

  useEffect(() => { loadGyms(); }, [loadGyms]);

  async function saveName() {
    if (!session) return;
    setErr(null);
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() || null })
      .eq('id', session.user.id);
    setSavingName(false);
    if (error) { setErr(error.message); return; }
    refreshProfile();
  }

  async function uploadAvatar(file: File) {
    if (!session) return;
    setErr(null);
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `profile-${session.user.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('employee-avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setErr(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from('employee-avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', session.user.id);
    setUploading(false);
    if (error) { setErr(error.message); return; }
    refreshProfile();
  }

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Your profile</Text>
        <Text style={styles.sub}>This is how the gyms you belong to see you.</Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.headerCard}>
        <AvatarWidget url={profile?.avatar_url ?? null} fallback={profile?.full_name ?? profile?.email ?? ''} busy={uploading} onPick={uploadAvatar} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Text style={styles.meta}>{profile?.email}</Text>
          {name !== (profile?.full_name ?? '') ? (
            <Pressable style={[styles.saveBtn, savingName && { opacity: 0.6 }]} disabled={savingName} onPress={saveName}>
              <Text style={styles.saveBtnText}>{savingName ? 'Saving…' : 'Save name'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Your gyms</Text>
        <Text style={styles.sectionSub}>
          Tap a gym to manage your membership, sign waivers, see your schedule, and more.
        </Text>
      </View>

      {rows === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>You're not a member of any gym yet.</Text>
          <Text style={styles.emptyBody}>Find one to join — that opens your member dashboard.</Text>
          <Pressable style={styles.findBtn} onPress={() => router.push('/member/find' as never)}>
            <Text style={styles.findBtnText}>Find a gym</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gymList}>
          {rows.map((r) => {
            const waiverState =
              r.waivers_total === 0 ? null :
              r.waivers_signed >= r.waivers_total ? { label: 'Waivers ✓', tone: 'good' as const } :
              { label: `${r.waivers_total - r.waivers_signed} unsigned waiver${r.waivers_total - r.waivers_signed === 1 ? '' : 's'}`, tone: 'warn' as const };
            return (
              <Pressable
                key={r.membership_id}
                style={styles.gymRow}
                onPress={() => router.push(`/m/${r.gym_id}` as never)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.gymName}>{r.gym_name}</Text>
                  <View style={styles.tagRow}>
                    <View style={[styles.tag, { backgroundColor: STATUS_COLORS[r.status] ?? theme.colors.textSecondary }]}>
                      <Text style={styles.tagText}>{r.status}</Text>
                    </View>
                    {waiverState ? (
                      <View style={[styles.tag, waiverState.tone === 'good' ? styles.tagGood : styles.tagWarn]}>
                        <Text style={[styles.tagText, waiverState.tone === 'good' ? { color: '#15803d' } : { color: '#92400e' }]}>
                          {waiverState.label}
                        </Text>
                      </View>
                    ) : null}
                    {r.is_employee ? (
                      <View style={[styles.tag, styles.tagEmployee]}>
                        <Text style={[styles.tagText, { color: '#fff' }]}>
                          {r.employee_position || 'Employee'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.gymMeta}>Joined {new Date(r.joined_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={styles.signOutBtn}
        onPress={async () => { await signOut(); router.replace('/' as never); }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function AvatarWidget({
  url, fallback, busy, onPick,
}: {
  url: string | null;
  fallback: string;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pick = () => inputRef.current?.click();

  return (
    <View style={styles.avatarCol}>
      {url ? (
        <Image source={{ uri: url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitials}>
            {(fallback || '?').split(/[\s@]/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>
      )}
      {Platform.OS === 'web' ? (
        <>
          <input
            ref={inputRef as any}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e: any) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = '';
            }}
          />
          <Pressable style={styles.avatarBtn} onPress={pick} disabled={busy}>
            <Text style={styles.avatarBtnText}>
              {busy ? 'Uploading…' : url ? 'Change photo' : 'Upload photo'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.dim}>Upload from the web for now.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 18, maxWidth: 900 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { fontSize: 11, color: theme.colors.textSecondary, fontStyle: 'italic' },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    flexWrap: 'wrap',
  },
  label: { fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  saveBtn: {
    alignSelf: 'flex-start', backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  avatarCol: { alignItems: 'center', gap: 6 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#e2e8f0' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '800', color: theme.colors.charcoal },
  avatarBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  avatarBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal, marginTop: 8 },
  sectionSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

  gymList: { gap: 8 },
  gymRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  gymName: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
  tagGood: { backgroundColor: '#dcfce7' },
  tagWarn: { backgroundColor: '#fef3c7' },
  tagEmployee: { backgroundColor: theme.colors.tealDark },
  gymMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },

  empty: {
    padding: 24, alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },
  findBtn: { marginTop: 8, backgroundColor: theme.colors.wyldPurple, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  findBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  signOutBtn: {
    alignSelf: 'flex-start', marginTop: 20,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  signOutText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
});
