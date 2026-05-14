import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  display_order: number;
  contacts: LocationContact[];
};

export function LocationsManager({ gymId }: { gymId: string }) {
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
    const { data, error } = await supabase
      .from('gym_locations')
      .insert({ gym_id: gymId, label: 'New location', display_order })
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
        <View key={loc.id} style={styles.locCard}>
          <View style={styles.locHeader}>
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
            <Pressable onPress={() => deleteLocation(loc.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
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
                    style={[styles.input, { flexBasis: 0, flexGrow: 2 }]}
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
                    style={[styles.input, { flexBasis: 0, flexGrow: 1 }]}
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
        </View>
      ))}

      <Pressable style={styles.btn} onPress={addLocation}>
        <Text style={styles.btnText}>+ Add location</Text>
      </Pressable>
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
  locHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locLabel: {
    flexGrow: 1,
    flexBasis: 0,
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
  contactRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
});
