import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type LocationContact = {
  id: string;
  location_id: string;
  kind: 'email' | 'phone';
  value: string;
  label: string | null;
  display_order: number;
};

export type GymLocation = {
  id: string;
  gym_id: string;
  label: string | null;
  slug: string | null;
  is_primary: boolean;
  is_paused: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  display_order: number;
  // Whether members at this gym's other locations can use this one
  // (e.g. drop in / book classes here). Off by default.
  allow_visiting_members: boolean;
  // Optional per-visit surcharge for visiting members, in cents.
  visiting_fee_cents: number;
  contacts: LocationContact[];
};

export function LocationsManager({
  gymId,
  multiLocationEnabled,
}: {
  gymId: string;
  multiLocationEnabled: boolean;
}) {
  const router = useRouter();
  const [locations, setLocations] = useState<GymLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: locs }, { data: contacts }] = await Promise.all([
        supabase
          .from('gym_locations')
          .select('*')
          .eq('gym_id', gymId)
          .order('display_order'),
        supabase
          .from('gym_location_contacts')
          .select('*')
          .order('display_order'),
      ]);
      if (cancelled) return;
      const byLoc: Record<string, LocationContact[]> = {};
      (contacts ?? []).forEach((c: any) => {
        (byLoc[c.location_id] ??= []).push(c);
      });
      setLocations(
        (locs ?? []).map((l: any) => ({ ...l, contacts: byLoc[l.id] ?? [] }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  async function addLocation() {
    const display_order = locations.length;
    const n = locations.length + 1;
    const { data, error } = await supabase
      .from('gym_locations')
      .insert({
        gym_id: gymId,
        label: `Location ${n}`,
        slug: `location-${n}`,
        display_order,
      })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setLocations([...locations, { ...(data as any), contacts: [] }]);
  }

  async function updateLocation(id: string, patch: Partial<GymLocation>) {
    setLocations(locations.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase.from('gym_locations').update(patch).eq('id', id);
    if (error) setError(error.message);
  }

  async function togglePause(id: string, paused: boolean) {
    setLocations(locations.map((l) => (l.id === id ? { ...l, is_paused: paused } : l)));
    const { error } = await supabase
      .from('gym_locations')
      .update({ is_paused: paused })
      .eq('id', id);
    if (error) setError(error.message);
  }

  async function deleteLocation(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this location and all its contacts?')) {
      return;
    }
    setLocations(locations.filter((l) => l.id !== id));
    const { error } = await supabase.from('gym_locations').delete().eq('id', id);
    if (error) setError(error.message);
  }

  async function addContact(locationId: string, kind: 'email' | 'phone') {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    const display_order = loc.contacts.length;
    const { data, error } = await supabase
      .from('gym_location_contacts')
      .insert({ location_id: locationId, kind, value: '', label: null, display_order })
      .select()
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setLocations(
      locations.map((l) =>
        l.id === locationId ? { ...l, contacts: [...l.contacts, data as any] } : l
      )
    );
  }

  async function updateContact(id: string, patch: Partial<LocationContact>) {
    setLocations(
      locations.map((l) => ({
        ...l,
        contacts: l.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }))
    );
    const { error } = await supabase.from('gym_location_contacts').update(patch).eq('id', id);
    if (error) setError(error.message);
  }

  async function deleteContact(id: string) {
    setLocations(
      locations.map((l) => ({
        ...l,
        contacts: l.contacts.filter((c) => c.id !== id),
      }))
    );
    const { error } = await supabase.from('gym_location_contacts').delete().eq('id', id);
    if (error) setError(error.message);
  }

  if (loading) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {locations.length === 0 ? (
        <Text style={styles.dim}>
          No locations yet. Add one to show on your Contact page.
        </Text>
      ) : null}
      {locations.map((loc) => (
        <View key={loc.id} style={[styles.locCard, loc.is_paused && styles.locCardPaused]}>
          <View style={styles.locHeader}>
            <View style={styles.locNameWrap}>
              <TextInput
                value={loc.label ?? ''}
                onChangeText={(v) =>
                  setLocations(locations.map((l) => (l.id === loc.id ? { ...l, label: v } : l)))
                }
                onBlur={() => updateLocation(loc.id, { label: loc.label })}
                placeholder="Location name (e.g. Downtown)"
                placeholderTextColor="#94a3b8"
                style={styles.locLabel}
              />
              {loc.is_paused ? (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSED</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.locActions}>
              <Pressable
                onPress={() => togglePause(loc.id, !loc.is_paused)}
                style={[styles.pauseBtn, loc.is_paused && styles.pauseBtnActive]}
              >
                <Text style={[styles.pauseBtnText, loc.is_paused && styles.pauseBtnTextActive]}>
                  {loc.is_paused ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
              <Pressable onPress={() => deleteLocation(loc.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
          {loc.is_paused ? (
            <Text style={styles.pausedHint}>
              Hidden from your public website. Still shown across your dashboard.
            </Text>
          ) : null}

          <View style={styles.row}>
            <Cell label="URL slug">
              <TextInput
                value={loc.slug ?? ''}
                onChangeText={(v) =>
                  setLocations(
                    locations.map((l) => (l.id === loc.id ? { ...l, slug: slugify(v) } : l))
                  )
                }
                onBlur={() =>
                  updateLocation(loc.id, { slug: slugify(loc.slug ?? '') || 'location' })
                }
                placeholder="downtown"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                autoCapitalize="none"
              />
            </Cell>
          </View>

          <View style={styles.row}>
            <Cell label="Street address">
              <TextInput
                value={loc.address_line1 ?? ''}
                onChangeText={(v) =>
                  setLocations(
                    locations.map((l) => (l.id === loc.id ? { ...l, address_line1: v } : l))
                  )
                }
                onBlur={() => updateLocation(loc.id, { address_line1: loc.address_line1 })}
                placeholder="123 Main St"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </Cell>
            <Cell label="Suite / unit">
              <TextInput
                value={loc.address_line2 ?? ''}
                onChangeText={(v) =>
                  setLocations(
                    locations.map((l) => (l.id === loc.id ? { ...l, address_line2: v } : l))
                  )
                }
                onBlur={() => updateLocation(loc.id, { address_line2: loc.address_line2 })}
                placeholder="Suite 200"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell label="City">
              <TextInput
                value={loc.city ?? ''}
                onChangeText={(v) =>
                  setLocations(locations.map((l) => (l.id === loc.id ? { ...l, city: v } : l)))
                }
                onBlur={() => updateLocation(loc.id, { city: loc.city })}
                style={styles.input}
              />
            </Cell>
            <Cell label="State">
              <TextInput
                value={loc.state ?? ''}
                onChangeText={(v) =>
                  setLocations(locations.map((l) => (l.id === loc.id ? { ...l, state: v } : l)))
                }
                onBlur={() => updateLocation(loc.id, { state: loc.state })}
                style={styles.input}
              />
            </Cell>
            <Cell label="ZIP">
              <TextInput
                value={loc.zip ?? ''}
                onChangeText={(v) =>
                  setLocations(locations.map((l) => (l.id === loc.id ? { ...l, zip: v } : l)))
                }
                onBlur={() => updateLocation(loc.id, { zip: loc.zip })}
                style={styles.input}
              />
            </Cell>
          </View>

          <View style={styles.contactList}>
            <Text style={styles.subTitle}>Emails &amp; phones</Text>
            {loc.contacts.length === 0 ? (
              <Text style={styles.dim}>None yet.</Text>
            ) : (
              loc.contacts.map((c) => (
                <View key={c.id} style={styles.contactRow}>
                  <View style={styles.kindPill}>
                    <Text style={styles.kindPillText}>{c.kind === 'email' ? 'Email' : 'Phone'}</Text>
                  </View>
                  <TextInput
                    value={c.value}
                    onChangeText={(v) =>
                      setLocations(
                        locations.map((l) => ({
                          ...l,
                          contacts: l.contacts.map((x) =>
                            x.id === c.id ? { ...x, value: v } : x
                          ),
                        }))
                      )
                    }
                    onBlur={() => updateContact(c.id, { value: c.value })}
                    placeholder={c.kind === 'email' ? 'team@example.com' : '(555) 555-5555'}
                    placeholderTextColor="#94a3b8"
                    keyboardType={c.kind === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    style={[styles.input, { flexBasis: 180, flexGrow: 2, flexShrink: 1, minWidth: 150 }]}
                  />
                  <TextInput
                    value={c.label ?? ''}
                    onChangeText={(v) =>
                      setLocations(
                        locations.map((l) => ({
                          ...l,
                          contacts: l.contacts.map((x) =>
                            x.id === c.id ? { ...x, label: v } : x
                          ),
                        }))
                      )
                    }
                    onBlur={() => updateContact(c.id, { label: c.label })}
                    placeholder="Label (Reception, Sales…)"
                    placeholderTextColor="#94a3b8"
                    style={[styles.input, { flexBasis: 120, flexGrow: 1, flexShrink: 1, minWidth: 110 }]}
                  />
                  <Pressable onPress={() => deleteContact(c.id)} style={styles.iconBtn}>
                    <Text style={styles.iconBtnText}>×</Text>
                  </Pressable>
                </View>
              ))
            )}
            <View style={styles.contactBtns}>
              <Pressable style={styles.btnSmall} onPress={() => addContact(loc.id, 'email')}>
                <Text style={styles.btnSmallText}>+ Email</Text>
              </Pressable>
              <Pressable style={styles.btnSmall} onPress={() => addContact(loc.id, 'phone')}>
                <Text style={styles.btnSmallText}>+ Phone</Text>
              </Pressable>
            </View>
          </View>

          {multiLocationEnabled && locations.length > 1 ? (
            <View style={styles.visitingBlock}>
              <Text style={styles.subTitle}>Cross-location access</Text>
              <Text style={styles.dim}>
                Let members from your other locations also use this one — free
                or with a per-visit charge.
              </Text>
              <Pressable
                style={styles.checkRow}
                onPress={() =>
                  updateLocation(loc.id, { allow_visiting_members: !loc.allow_visiting_members })
                }
              >
                <View style={[styles.checkBox, loc.allow_visiting_members && styles.checkBoxOn]}>
                  {loc.allow_visiting_members ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>
                  Allow members from our other locations to use this one
                </Text>
              </Pressable>

              {loc.allow_visiting_members ? (
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Per-visit fee (USD)</Text>
                  <TextInput
                    value={loc.visiting_fee_cents > 0 ? (loc.visiting_fee_cents / 100).toFixed(2) : ''}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9.]/g, '');
                      setLocations(
                        locations.map((l) =>
                          l.id === loc.id
                            ? { ...l, visiting_fee_cents: Math.round((Number(cleaned) || 0) * 100) }
                            : l,
                        ),
                      );
                    }}
                    onBlur={() => updateLocation(loc.id, { visiting_fee_cents: loc.visiting_fee_cents })}
                    placeholder="0.00 (free)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    style={[styles.input, { maxWidth: 140 }]}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}

      {multiLocationEnabled || locations.length === 0 ? (
        <Pressable style={styles.btn} onPress={addLocation}>
          <Text style={styles.btnText}>+ Add location</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.upgradeBtn}
          onPress={() => router.push('/owner/billing' as never)}
        >
          <Text style={styles.upgradeBtnText}>Upgrade to add more locations</Text>
        </Pressable>
      )}
    </View>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  error: { color: theme.colors.danger, fontSize: 13 },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 13 },
  locCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 12,
    backgroundColor: '#fff',
  },
  locCardPaused: { backgroundColor: '#f8fafc', borderColor: '#fcd34d' },
  locHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  locNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    minWidth: 140,
  },
  locActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  pauseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pauseBtnActive: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  pauseBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  pauseBtnTextActive: { color: '#92400e' },
  pausedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  pausedBadgeText: { fontSize: 10, fontWeight: '800', color: '#92400e', letterSpacing: 0.6 },
  pausedHint: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  locLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 100,
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.charcoal,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#f8fafc',
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.danger },
  primaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.wyldPurple,
  },
  primaryBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  makePrimaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  makePrimaryBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  upgradeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.wyldPurple,
    borderStyle: 'dashed',
  },
  upgradeBtnText: { color: theme.colors.wyldPurple, fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  cell: { flexGrow: 1, flexBasis: 0, minWidth: 140, gap: 4 },
  cellLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  contactList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    gap: 8,
  },
  subTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  contactRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  kindPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  kindPillText: { fontSize: 11, fontWeight: '800', color: '#4338ca', letterSpacing: 0.4 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconBtnText: { fontSize: 18, lineHeight: 18, color: theme.colors.charcoal, fontWeight: '700' },
  contactBtns: { flexDirection: 'row', gap: 8 },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSmallText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },

  visitingBlock: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkBox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkBoxOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13, color: theme.colors.charcoal, fontWeight: '600' },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  feeLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
});
