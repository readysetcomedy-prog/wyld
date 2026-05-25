// Admin gym directory. Lists every customer gym (excluding WyLD itself —
// that's the platform org, not a gym), with paginated server-side search.
// "Add gym" creates a new gym row via wyld_create_gym() which auto-fills
// the join_code and lets the admin optionally assign an existing
// profile as owner. The owner is NOT mandatory — sometimes we onboard
// gyms whose owner hasn't signed up yet.

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type GymRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  custom_domain: string | null;
  owner_name: string | null;
  owner_email: string | null;
};

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function GymsList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Paginated query. Search hits server-side ilike on name/city/state/slug;
  // owner-name/email are filled in after the page is fetched (owner lookup
  // is one extra query per page, bounded by pageSize). WyLD's own row is
  // filtered out — it's an org, not a customer gym.
  const loadPage = useCallback(async (from: number, to: number) => {
    setError(null);
    let q = supabase
      .from('gyms')
      .select('id, name, slug, city, state, custom_domain, owner_id')
      .neq('slug', 'wyld');
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`name.ilike.${p},city.ilike.${p},state.ilike.${p},slug.ilike.${p}`);
    }
    const { data, error: qErr } = await q.order('name').range(from, to);
    if (qErr) { setError(qErr.message); return []; }
    const rows = (data ?? []) as any[];
    const ownerIds = Array.from(
      new Set(rows.map((g) => g.owner_id).filter(Boolean) as string[]),
    );
    let ownersById: Record<string, { full_name: string | null; email: string }> = {};
    if (ownerIds.length) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds);
      ownersById = Object.fromEntries(
        (owners ?? []).map((o: any) => [o.id, { full_name: o.full_name, email: o.email }]),
      );
    }
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      city: g.city,
      state: g.state,
      custom_domain: g.custom_domain,
      owner_name: g.owner_id ? ownersById[g.owner_id]?.full_name ?? null : null,
      owner_email: g.owner_id ? ownersById[g.owner_id]?.email ?? null : null,
    })) as GymRow[];
  }, [debouncedSearch]);

  const { items: gyms, loading, hasMore, loadMore, reload } = useInfiniteList<GymRow>({
    pageSize: 50,
    load: loadPage,
    deps: [debouncedSearch],
  });

  useEffect(() => {
    const sub = supabase
      .channel('admin-gyms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gyms' },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [reload]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gyms</Text>
          <Text style={styles.subtitle}>
            {gyms ? `${gyms.length} loaded${hasMore ? '+' : ''}` : 'Loading…'}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>+ Add gym</Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, city, state, or slug"
        placeholderTextColor="#94a3b8"
        style={styles.search}
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {gyms == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} style={{ marginTop: 24 }} />
      ) : gyms.length === 0 ? (
        <Text style={styles.empty}>
          {debouncedSearch ? 'No matches.' : 'No gyms yet. Click "+ Add gym" to create one.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {gyms.map((g) => (
            <Pressable
              key={g.id}
              style={styles.row}
              onPress={() => router.push(`/admin/gyms/${g.id}` as never)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{g.name}</Text>
                <Text style={styles.rowMeta}>
                  {[g.city, g.state].filter(Boolean).join(', ') || '—'}
                  {g.slug ? `  ·  /${g.slug}` : ''}
                </Text>
                <Text style={styles.rowOwner}>
                  {g.owner_name ?? g.owner_email ?? 'No owner linked'}
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </Pressable>
          ))}
          <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </View>
      )}

      <AddGymModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(newId) => {
          setAddOpen(false);
          reload();
          router.push(`/admin/gyms/${newId}` as never);
        }}
      />
    </View>
  );
}

// ---- Add-gym modal ----------------------------------------------------

type OwnerCandidate = {
  user_id: string;
  full_name: string | null;
  email: string;
  current_role: string;
};

function AddGymModal({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [owner, setOwner] = useState<OwnerCandidate | null>(null);
  const [pickOwner, setPickOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setCity('');
      setState('');
      setCustomDomain('');
      setOwner(null);
      setErr(null);
    }
  }, [visible]);

  // Auto-fill slug from name until the admin manually edits it.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function create() {
    setErr(null);
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (!slug.trim()) { setErr('Slug is required.'); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc('wyld_create_gym', {
      p_name: name.trim(),
      p_slug: slug.trim().toLowerCase(),
      p_city: city.trim() || null,
      p_state: state.trim() || null,
      p_custom_domain: customDomain.trim() || null,
      p_owner_user_id: owner?.user_id ?? null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    // The RPC returns table(id, join_code) so data is an array of rows.
    const newId = (Array.isArray(data) ? (data[0] as any)?.id : (data as any)?.id) as string | undefined;
    if (!newId) { setErr('Gym was created but no ID came back.'); return; }
    onCreated(newId);
  }

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Add gym</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>

          <ScrollView>
            <Field label="Gym name *">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Bear Gym"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </Field>

            <Field label="URL slug *">
              <TextInput
                value={slug}
                onChangeText={(v) => { setSlugTouched(true); setSlug(slugify(v)); }}
                placeholder="bear-gym"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                style={modalStyles.input}
              />
              <Text style={modalStyles.hint}>
                Lives at wyldinc.com/g/{slug || 'your-slug'}.
              </Text>
            </Field>

            <View style={modalStyles.row}>
              <Field label="City" style={{ flex: 1 }}>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Centralia"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
              <Field label="State" style={{ flex: 1 }}>
                <TextInput
                  value={state}
                  onChangeText={setState}
                  placeholder="WA"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={modalStyles.input}
                />
              </Field>
            </View>

            <Field label="Custom domain (optional)">
              <TextInput
                value={customDomain}
                onChangeText={setCustomDomain}
                placeholder="beargym.com"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                style={modalStyles.input}
              />
            </Field>

            <Field label="Owner (optional)">
              {owner ? (
                <View style={modalStyles.ownerCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.ownerName}>{owner.full_name || owner.email}</Text>
                    <Text style={modalStyles.ownerEmail}>{owner.email}</Text>
                    <Text style={modalStyles.ownerRole}>
                      Currently: {owner.current_role}
                      {owner.current_role !== 'gym_owner' ? '  →  will become gym_owner' : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => setOwner(null)}>
                    <Text style={modalStyles.linkAction}>Clear</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={modalStyles.findOwnerBtn} onPress={() => setPickOwner(true)}>
                  <Text style={modalStyles.findOwnerBtnText}>Find owner from members…</Text>
                </Pressable>
              )}
              <Text style={modalStyles.hint}>
                Leave blank if the owner hasn't signed up for WyLD yet — you can
                assign them later from the gym's detail page.
              </Text>
            </Field>

            {err ? <Text style={modalStyles.err}>{err}</Text> : null}

            <View style={modalStyles.actionRow}>
              <Pressable
                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={create}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? 'Creating…' : 'Create gym'}</Text>
              </Pressable>
              <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
                <Text style={modalStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>

      <OwnerPickerModal
        visible={pickOwner}
        onClose={() => setPickOwner(false)}
        onPick={(c) => { setOwner(c); setPickOwner(false); }}
      />
    </Modal>
  );
}

// ---- Owner picker -----------------------------------------------------

function OwnerPickerModal({
  visible, onClose, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: OwnerCandidate) => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Search across every profile. We don't constrain by role — admins can
  // pick anyone (member, employee, even another owner) as the new gym's
  // owner; the create-gym RPC will promote them to gym_owner.
  const loadPage = useCallback(async (from: number, to: number) => {
    let q = supabase
      .from('profiles')
      .select('id, full_name, email, role');
    if (debouncedSearch) {
      const p = `%${debouncedSearch.replace(/[%_]/g, '\\$&')}%`;
      q = q.or(`email.ilike.${p},full_name.ilike.${p}`);
    }
    const { data } = await q.order('full_name', { nullsFirst: false }).range(from, to);
    return ((data as any[]) ?? []).map((r) => ({
      user_id: r.id,
      full_name: r.full_name,
      email: r.email,
      current_role: r.role,
    })) as OwnerCandidate[];
  }, [debouncedSearch]);

  const { items: candidates, loading, hasMore, loadMore } = useInfiniteList<OwnerCandidate>({
    pageSize: 30,
    load: loadPage,
    deps: [visible, debouncedSearch],
  });

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { maxWidth: 520 }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Find owner</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email…"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            style={modalStyles.input}
          />

          <ScrollView style={{ marginTop: 10 }}>
            {candidates === null ? (
              <ActivityIndicator color={theme.colors.wyldPurple} />
            ) : candidates.length === 0 ? (
              <Text style={modalStyles.hint}>No matches.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {candidates.map((c) => (
                  <Pressable
                    key={c.user_id}
                    style={modalStyles.candidateRow}
                    onPress={() => onPick(c)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={modalStyles.ownerName}>{c.full_name || c.email}</Text>
                      <Text style={modalStyles.ownerEmail}>{c.email}</Text>
                    </View>
                    <View style={modalStyles.rolePill}>
                      <Text style={modalStyles.rolePillText}>{c.current_role}</Text>
                    </View>
                  </Pressable>
                ))}
                <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---- Small field wrapper ---------------------------------------------

function Field({
  label, children, style,
}: {
  label: string; children: React.ReactNode; style?: any;
}) {
  return (
    <View style={[modalStyles.field, style]}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md, maxWidth: 960 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  addBtn: {
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
  list: { gap: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  rowMeta: { fontSize: 13, color: theme.colors.textSecondary },
  rowOwner: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  rowChevron: { fontSize: 28, color: theme.colors.textSecondary, lineHeight: 28 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: {
    backgroundColor: '#fff', borderRadius: 16, padding: 22,
    width: '100%', maxWidth: 560, maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal, flex: 1 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  row: { flexDirection: 'row', gap: 10 },
  field: { gap: 4, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
    color: theme.colors.charcoal, backgroundColor: '#fff',
  },
  hint: { fontSize: 11, color: theme.colors.textSecondary, lineHeight: 16, marginTop: 4 },
  err: { color: theme.colors.danger, fontSize: 13, marginTop: 6 },

  findOwnerBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  findOwnerBtnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },

  ownerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  ownerName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  ownerEmail: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  ownerRole: { fontSize: 11, color: theme.colors.wyldPurple, fontWeight: '700', marginTop: 4 },
  linkAction: { color: theme.colors.danger, fontWeight: '700', fontSize: 12 },

  candidateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  rolePillText: { fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: {
    flex: 1, backgroundColor: theme.colors.wyldPurple,
    paddingVertical: 11, borderRadius: 8, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cancelBtnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
});
