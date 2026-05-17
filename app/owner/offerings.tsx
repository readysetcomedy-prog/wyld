import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

type Offering = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  display_order: number;
};

type Form = { id?: string; name: string; description: string; price: string };

export default function OwnerOfferings() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const { data, error } = await supabase
      .from('gym_offerings')
      .select('*')
      .eq('gym_id', gymId)
      .order('display_order');
    if (error) setErr(error.message);
    setOfferings((data as Offering[]) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form || !gymId) return;
    setErr(null);
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    let priceCents: number | null = null;
    if (form.price.trim()) {
      const n = Number(form.price);
      if (!Number.isFinite(n) || n < 0) {
        setErr('Price must be a positive number, or blank.');
        return;
      }
      priceCents = Math.round(n * 100);
    }
    const payload: any = {
      gym_id: gymId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
    };
    setSaving(true);
    const res = form.id
      ? await supabase.from('gym_offerings').update(payload).eq('id', form.id)
      : await supabase
          .from('gym_offerings')
          .insert({ ...payload, display_order: offerings?.length ?? 0 });
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setForm(null);
    load();
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this offering?')) return;
    const { error } = await supabase.from('gym_offerings').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setForm(null);
    load();
  }

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Offerings</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }
  if (offerings === null) return <ActivityIndicator color={theme.colors.charcoal} />;

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Offerings</Text>
        <Text style={styles.sub}>
          Memberships, passes, and packages — e.g. &ldquo;Monthly Yoga Pass&rdquo;. These appear
          on your public Services page and can have waivers attached.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {!form ? (
        <Pressable
          style={styles.btn}
          onPress={() => setForm({ name: '', description: '', price: '' })}
        >
          <Text style={styles.btnText}>+ Add offering</Text>
        </Pressable>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{form.id ? 'Edit' : 'New'} offering</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            placeholder="Monthly Yoga Pass"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            placeholder="What's included…"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
          />
          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            value={form.price}
            onChangeText={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })}
            placeholder="49.00"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <View style={styles.formButtons}>
            <Pressable style={styles.btn} onPress={save} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setForm(null)}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            {form.id ? (
              <Pressable style={styles.btnDanger} onPress={() => remove(form.id!)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {offerings.length === 0 ? (
        <Text style={styles.dim}>No offerings yet. Add your first one above.</Text>
      ) : (
        <View style={styles.list}>
          {offerings.map((o) => (
            <View key={o.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{o.name}</Text>
                {o.description ? <Text style={styles.cardDesc}>{o.description}</Text> : null}
              </View>
              <Text style={styles.cardPrice}>
                {o.price_cents != null ? `$${(o.price_cents / 100).toFixed(2)}` : '—'}
              </Text>
              <Pressable
                onPress={() =>
                  setForm({
                    id: o.id,
                    name: o.name,
                    description: o.description ?? '',
                    price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '',
                  })
                }
                style={styles.editBtn}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 8,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
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
  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  cardDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: theme.colors.wyldPurple },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
});
