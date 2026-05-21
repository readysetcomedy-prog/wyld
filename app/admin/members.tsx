import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Role } from '@/lib/auth';
import { Roster, RolesEditor } from '@/app/owner/employees';
import { SubTabsPage } from '@/components/SubTabs';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  gym_owner: 'Owner',
  gym_employee: 'Employee',
  member: 'Member',
};

const ROLE_COLOR: Record<Role, string> = {
  admin: '#dc2626',
  gym_owner: '#7C3AED',
  gym_employee: '#0F766E',
  member: '#475569',
};

export default function AdminMembers() {
  const [wyldGymId, setWyldGymId] = useState<string | null>(null);
  const [rosterKey, setRosterKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gyms')
        .select('id')
        .eq('slug', 'wyld')
        .maybeSingle();
      setWyldGymId((data as any)?.id ?? null);
    })();
  }, []);

  return (
    <SubTabsPage
      title="Members"
      blurb="Everyone who's signed up — members, gym staff, and admins. Promote anyone here to a WyLD employee."
      tabs={[
        {
          key: 'all',
          label: 'All profiles',
          body: (
            <AllProfiles
              wyldGymId={wyldGymId}
              onAdded={() => setRosterKey((k) => k + 1)}
            />
          ),
        },
        {
          key: 'wyld-roster',
          label: 'WyLD roster',
          body: <Roster key={rosterKey} gymId={wyldGymId} />,
        },
        {
          key: 'wyld-roles',
          label: 'WyLD roles',
          body: <RolesEditor gymId={wyldGymId} />,
        },
      ]}
    />
  );
}

function AllProfiles({
  wyldGymId,
  onAdded,
}: {
  wyldGymId: string | null;
  onAdded: () => void;
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [wyldEmails, setWyldEmails] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .order('created_at', { ascending: false });
    setProfiles((profileRows as Profile[]) ?? []);
    if (wyldGymId) {
      const { data: employeeRows } = await supabase
        .from('gym_employees')
        .select('email')
        .eq('gym_id', wyldGymId);
      setWyldEmails(
        new Set(((employeeRows as any[]) ?? []).map((r) => r.email.toLowerCase()))
      );
    } else {
      setWyldEmails(new Set());
    }
  }, [wyldGymId]);

  useEffect(() => {
    load();
  }, [load]);

  async function promote(p: Profile) {
    if (!wyldGymId) return;
    setErr(null);
    const { error } = await supabase.from('gym_employees').insert({
      gym_id: wyldGymId,
      user_id: p.id,
      email: p.email.toLowerCase(),
      full_name: p.full_name || p.email,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
    onAdded();
  }

  const filtered = useMemo(() => {
    if (!profiles) return [];
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.full_name ?? '').toLowerCase().includes(q) ||
        ROLE_LABEL[p.role].toLowerCase().includes(q)
    );
  }, [profiles, search]);

  if (profiles === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <View style={styles.root}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, email, or role…"
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {filtered.length === 0 ? (
        <Text style={styles.dim}>No matches.</Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((p) => {
            const isWyld = wyldEmails.has(p.email.toLowerCase());
            return (
              <View key={p.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.full_name || '—'}</Text>
                  <Text style={styles.email}>{p.email}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: ROLE_COLOR[p.role] }]}>
                  <Text style={styles.badgeText}>{ROLE_LABEL[p.role]}</Text>
                </View>
                {isWyld ? (
                  <View style={styles.wyldBadge}>
                    <Text style={styles.wyldBadgeText}>WyLD employee</Text>
                  </View>
                ) : wyldGymId ? (
                  <Pressable style={styles.btn} onPress={() => promote(p)}>
                    <Text style={styles.btnText}>+ Add as WyLD employee</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
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
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    flexWrap: 'wrap',
  },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  email: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.4 },
  wyldBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f3effe',
    borderWidth: 1,
    borderColor: theme.colors.wyldPurple,
  },
  wyldBadgeText: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 11 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
