import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Modal,
  ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useGymTheme } from '@/lib/gymTheme';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type Membership = {
  id: string;
  member_id: string;
  gym_id: string;
  status: string;
  joined_at: string;
  notes: string | null;
  member: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  is_employee: boolean;
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  active: theme.colors.tealDark,
  paused: '#B45309',
  cancelled: theme.colors.danger,
};

export default function OwnerMembers() {
  const { profile } = useAuth();
  const router = useRouter();
  const gymTheme = useGymTheme();
  const gymId = profile?.gym_id ?? null;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openMember, setOpenMember] = useState<Membership | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Employee-detection lookup. Employees per gym are bounded enough to
  // load eagerly; member counts are not.
  const [empUserIds, setEmpUserIds] = useState<Set<string>>(new Set());
  const [empEmails, setEmpEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!gymId) return;
    supabase
      .from('gym_employees')
      .select('user_id, email')
      .eq('gym_id', gymId)
      .then(({ data }) => {
        setEmpUserIds(new Set(((data as any[]) ?? []).map((e) => e.user_id).filter(Boolean)));
        setEmpEmails(new Set(((data as any[]) ?? []).map((e) => (e.email ?? '').toLowerCase()).filter(Boolean)));
      });
  }, [gymId]);

  // Debounce the search box so each keystroke doesn't fire a new query
  // (each search edit resets the paginated list — see deps below).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Server-side paginated load. Search/status are pushed into the query so
  // even gyms with thousands of members never have to ship more than one
  // page to the client.
  const loadPage = useCallback(async (from: number, to: number) => {
    if (!gymId) return [];
    let q = supabase
      .from('gym_memberships')
      .select('id, member_id, gym_id, status, joined_at, notes, member:profiles(id, email, full_name, avatar_url)')
      .eq('gym_id', gymId);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (debouncedSearch) {
      // Foreign-table search needs server-side filtering on the joined
      // table. profiles.full_name ILIKE OR profiles.email ILIKE.
      const pattern = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`full_name.ilike.${pattern},email.ilike.${pattern}`, { foreignTable: 'profiles' });
    }
    const { data } = await q.order('joined_at', { ascending: false }).range(from, to);
    const rows = (data as any[]) ?? [];
    // When searching, the join filter can return memberships whose
    // member didn't match (because we requested all memberships and the
    // foreign filter only nulled-out the join). Drop those.
    return rows
      .filter((r) => !debouncedSearch || r.member)
      .map((r) => ({
        ...r,
        is_employee: empUserIds.has(r.member_id) || empEmails.has((r.member?.email ?? '').toLowerCase()),
      })) as Membership[];
  }, [gymId, statusFilter, debouncedSearch, empUserIds, empEmails]);

  const { items: filtered, loading, hasMore, loadMore, reload } = useInfiniteList<Membership>({
    pageSize: 50,
    load: loadPage,
    deps: [gymId, statusFilter, debouncedSearch, empUserIds.size, empEmails.size],
  });

  async function updateStatus(m: Membership, status: string) {
    await supabase.from('gym_memberships').update({ status }).eq('id', m.id);
    reload();
    setOpenMember((cur) => cur && cur.id === m.id ? { ...cur, status } : cur);
  }

  async function saveNotes(m: Membership, notes: string) {
    await supabase.from('gym_memberships').update({ notes: notes || null }).eq('id', m.id);
    setOpenMember((cur) => cur && cur.id === m.id ? { ...cur, notes } : cur);
    reload();
  }

  async function removeMembership(m: Membership) {
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${m.member.full_name || m.member.email} from your gym?`)) return;
    await supabase.from('gym_memberships').delete().eq('id', m.id);
    setOpenMember(null);
    reload();
  }

  async function addAsEmployee(m: Membership) {
    if (!gymId) return;
    if (m.is_employee) { router.push('/owner/employees' as never); return; }
    const { error } = await supabase.from('gym_employees').insert({
      gym_id: gymId,
      user_id: m.member_id,
      email: m.member.email,
      full_name: m.member.full_name ?? m.member.email,
    });
    if (error) { setErr(error.message); return; }
    setOpenMember(null);
    reload();
    router.push('/owner/employees' as never);
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Members</Text>
          <Text style={styles.sub}>
            Active members, payment status, and notes. Tap a member to manage.
          </Text>
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: gymTheme.primary }]}
          onPress={() => setAddOpen(true)}
        >
          <Text style={styles.addBtnText}>+ Add member</Text>
        </Pressable>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.toolbar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email…"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.search}
        />
        <View style={styles.filterRow}>
          {(['all', 'active', 'paused', 'cancelled'] as const).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.filterChip,
                statusFilter === s && { backgroundColor: gymTheme.primary, borderColor: gymTheme.primary },
              ]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {filtered === null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No members match.</Text>
          <Text style={styles.emptyBody}>
            {debouncedSearch || statusFilter !== 'all'
              ? 'Try clearing the search or status filter.'
              : 'Members will appear here as people join your gym.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((m) => (
            <Pressable key={m.id} style={styles.row} onPress={() => setOpenMember(m)}>
              <View style={styles.avatar}>
                {m.member.avatar_url ? (
                  <Image source={{ uri: m.member.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {(m.member.full_name ?? m.member.email).split(/[\s@]/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {m.member.full_name || m.member.email}
                  </Text>
                  {m.is_employee ? (
                    <View style={styles.empBadge}>
                      <Text style={styles.empBadgeText}>Employee</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {m.member.email} · joined {new Date(m.joined_at).toLocaleDateString()}
                </Text>
                {m.notes ? (
                  <Text style={styles.rowNote} numberOfLines={1}>📝 {m.notes}</Text>
                ) : null}
              </View>
              <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[m.status] ?? theme.colors.textSecondary }]}>
                <Text style={styles.statusPillText}>{m.status}</Text>
              </View>
            </Pressable>
          ))}
          <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </View>
      )}

      <MemberDetailModal
        member={openMember}
        onClose={() => setOpenMember(null)}
        onStatusChange={updateStatus}
        onSaveNotes={saveNotes}
        onRemove={removeMembership}
        onAddAsEmployee={addAsEmployee}
      />

      <AddMemberModal
        visible={addOpen}
        gymId={gymId}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); reload(); }}
      />
    </View>
  );
}

// ---- Detail modal ---------------------------------------------------------

function MemberDetailModal({
  member, onClose, onStatusChange, onSaveNotes, onRemove, onAddAsEmployee,
}: {
  member: Membership | null;
  onClose: () => void;
  onStatusChange: (m: Membership, status: string) => Promise<void>;
  onSaveNotes: (m: Membership, notes: string) => Promise<void>;
  onRemove: (m: Membership) => Promise<void>;
  onAddAsEmployee: (m: Membership) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (member) { setNotes(member.notes ?? ''); setNotesDirty(false); }
  }, [member?.id]);

  if (!member) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.title}>{member.member.full_name || member.member.email}</Text>
              <Text style={modalStyles.sub}>{member.member.email}</Text>
            </View>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>

          <ScrollView>
            <Text style={modalStyles.sectionLabel}>Status</Text>
            <View style={modalStyles.statusRow}>
              {STATUS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[modalStyles.statusBtn, member.status === opt.value && modalStyles.statusBtnActive]}
                  onPress={() => onStatusChange(member, opt.value)}
                >
                  <Text style={[modalStyles.statusBtnText, member.status === opt.value && modalStyles.statusBtnTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={modalStyles.sectionLabel}>Joined</Text>
            <Text style={modalStyles.value}>
              {new Date(member.joined_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </Text>

            <Text style={modalStyles.sectionLabel}>Staff notes (private)</Text>
            <TextInput
              style={modalStyles.notes}
              value={notes}
              onChangeText={(v) => { setNotes(v); setNotesDirty(true); }}
              placeholder="Anything to remember about this member — payment quirks, preferences, history."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
            />
            {notesDirty ? (
              <Pressable
                style={[modalStyles.saveNotesBtn, savingNotes && { opacity: 0.6 }]}
                disabled={savingNotes}
                onPress={async () => { setSavingNotes(true); await onSaveNotes(member, notes); setNotesDirty(false); setSavingNotes(false); }}
              >
                <Text style={modalStyles.saveNotesText}>{savingNotes ? 'Saving…' : 'Save notes'}</Text>
              </Pressable>
            ) : null}

            <View style={modalStyles.actionRow}>
              <Pressable style={modalStyles.actionBtn} onPress={() => onAddAsEmployee(member)}>
                <Text style={modalStyles.actionBtnText}>
                  {member.is_employee ? 'Open in Employees →' : '+ Add as employee'}
                </Text>
              </Pressable>
              <Pressable style={[modalStyles.actionBtn, modalStyles.actionDanger]} onPress={() => onRemove(member)}>
                <Text style={[modalStyles.actionBtnText, modalStyles.actionDangerText]}>Remove from gym</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Add member modal ----------------------------------------------------

function AddMemberModal({
  visible, gymId, onClose, onAdded,
}: {
  visible: boolean;
  gymId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (visible) { setEmail(''); setErr(null); } }, [visible]);

  async function submit() {
    if (!gymId) return;
    const e = email.trim().toLowerCase();
    if (!e) { setErr('Enter an email.'); return; }
    setBusy(true);
    setErr(null);

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', e)
      .maybeSingle();

    if (!prof) {
      setBusy(false);
      setErr(`No WyLD account yet for ${e}. Have them sign up first, then add them here.`);
      return;
    }

    const { data: existing } = await supabase
      .from('gym_memberships')
      .select('id')
      .eq('gym_id', gymId)
      .eq('member_id', (prof as any).id)
      .maybeSingle();
    if (existing) {
      setBusy(false);
      setErr(`${e} is already a member.`);
      return;
    }

    const { error } = await supabase.from('gym_memberships').insert({
      gym_id: gymId,
      member_id: (prof as any).id,
      status: 'active',
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAdded();
  }

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { maxWidth: 460 }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add member</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>

          <Text style={modalStyles.sectionLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="member@example.com"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={modalStyles.emailInput}
          />
          <Text style={modalStyles.hint}>
            The person must already have a WyLD account. If they don't, ask them
            to sign up at this gym's website or at WyLD.io.
          </Text>

          {err ? <Text style={modalStyles.err}>{err}</Text> : null}

          <Pressable style={[modalStyles.saveNotesBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
            <Text style={modalStyles.saveNotesText}>{busy ? 'Adding…' : 'Add member'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.md, maxWidth: 1000 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  addBtn: {
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  err: { color: theme.colors.danger, fontSize: 13 },

  toolbar: { gap: theme.spacing.sm },
  search: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  filterChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  filterChipTextActive: { color: '#fff' },

  empty: {
    padding: theme.spacing.xl, alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  emptyBody: { color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },

  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    backgroundColor: theme.colors.wyldPurple, alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal, flexShrink: 1 },
  rowMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  rowNote: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  empBadge: { backgroundColor: theme.colors.tealDark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  empBadgeText: { color: '#fff', fontWeight: '800', fontSize: 9, letterSpacing: 0.4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { color: '#fff', fontWeight: '800', fontSize: 11, textTransform: 'capitalize' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 520, maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 6,
  },
  value: { fontSize: 14, color: theme.colors.charcoal },

  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff', alignItems: 'center',
  },
  statusBtnActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  statusBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  statusBtnTextActive: { color: '#fff' },

  notes: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: '#fff', minHeight: 90, textAlignVertical: 'top',
  },
  saveNotesBtn: {
    alignSelf: 'flex-start', backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, marginTop: 10,
  },
  saveNotesText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 24, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, minWidth: 180,
    paddingVertical: 11, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff', alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  actionDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  actionDangerText: { color: theme.colors.danger },

  emailInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  hint: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  err: { color: theme.colors.danger, fontSize: 13, marginTop: 10 },
});
