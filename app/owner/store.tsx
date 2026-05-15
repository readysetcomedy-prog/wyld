import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { pickAndUploadImages } from '@/components/ImageUpload';

type Product = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  currency: string;
  sku: string | null;
  inventory_location: string | null;
  image_url: string | null;
  published: boolean;
  display_order: number;
  category: string | null;
  featured: boolean;
};

type Form = {
  id?: string;
  name: string;
  description: string;
  price: string; // dollars input
  sku: string;
  inventory_location: string;
  image_url: string | null;
  published: boolean;
  category: string;
  featured: boolean;
};

const EMPTY: Form = {
  name: '',
  description: '',
  price: '',
  sku: '',
  inventory_location: '',
  image_url: null,
  published: true,
  category: '',
  featured: false,
};

export default function OwnerStore() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [storeEnabled, setStoreEnabled] = useState<boolean | null>(null);
  const [storeVisible, setStoreVisible] = useState<boolean>(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: m }, { data: prods, error }] = await Promise.all([
      supabase
        .from('gym_modules')
        .select('store_enabled, store_visible')
        .eq('gym_id', gymId)
        .maybeSingle(),
      supabase
        .from('gym_products')
        .select('*')
        .eq('gym_id', gymId)
        .order('display_order'),
    ]);
    setStoreEnabled(!!(m as any)?.store_enabled);
    setStoreVisible(!!(m as any)?.store_visible);
    if (error) setErr(error.message);
    setProducts((prods as Product[]) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadImage() {
    if (!gymId || !form) return;
    setUploading(true);
    const urls = await pickAndUploadImages(gymId, { multiple: false });
    setUploading(false);
    if (urls[0]) setForm({ ...form, image_url: urls[0] });
  }

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
      sku: form.sku.trim() || null,
      inventory_location: form.inventory_location.trim() || null,
      image_url: form.image_url,
      published: form.published,
      category: form.category.trim() || null,
      featured: form.featured,
    };
    setSaving(true);
    if (form.id) {
      const { error } = await supabase.from('gym_products').update(payload).eq('id', form.id);
      setSaving(false);
      if (error) {
        setErr(error.message);
        return;
      }
    } else {
      payload.display_order = (products?.length ?? 0);
      const { error } = await supabase.from('gym_products').insert(payload);
      setSaving(false);
      if (error) {
        setErr(error.message);
        return;
      }
    }
    setForm(null);
    load();
  }

  async function deleteProduct(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this product?')) return;
    const { error } = await supabase.from('gym_products').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  async function togglePublished(p: Product) {
    setProducts((products ?? []).map((x) => (x.id === p.id ? { ...x, published: !p.published } : x)));
    const { error } = await supabase
      .from('gym_products')
      .update({ published: !p.published })
      .eq('id', p.id);
    if (error) {
      setErr(error.message);
      load();
    }
  }

  async function toggleStoreVisible(v: boolean) {
    if (!gymId) return;
    setStoreVisible(v);
    const { error } = await supabase
      .from('gym_modules')
      .update({ store_visible: v })
      .eq('gym_id', gymId);
    if (error) {
      setErr(error.message);
      setStoreVisible(!v);
    }
  }

  function edit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      price: p.price_cents != null ? (p.price_cents / 100).toFixed(2) : '',
      sku: p.sku ?? '',
      inventory_location: p.inventory_location ?? '',
      image_url: p.image_url,
      published: p.published,
      category: p.category ?? '',
      featured: p.featured,
    });
  }

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Store</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }

  if (products === null || storeEnabled === null) {
    return <ActivityIndicator color={theme.colors.charcoal} />;
  }

  if (!storeEnabled) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Store</Text>
        <Text style={styles.dim}>The Store module isn&apos;t enabled for your gym yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Store</Text>
        <Text style={styles.sub}>
          Add products with photos, prices, and inventory details. Anything you publish
          shows on your public site&apos;s Store page. Inventory location stays private.
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>Show Store on public site</Text>
          <Text style={styles.statusSub}>
            When off, the Store tab is hidden from visitors even though you can keep
            editing products here.
          </Text>
        </View>
        <Switch value={storeVisible} onValueChange={toggleStoreVisible} />
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {!form ? (
        <Pressable style={styles.btn} onPress={() => setForm({ ...EMPTY })}>
          <Text style={styles.btnText}>+ Add product</Text>
        </Pressable>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{form.id ? 'Edit' : 'New'} product</Text>

          <View style={styles.row}>
            <View style={styles.imageCol}>
              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.imageBig} resizeMode="cover" />
              ) : (
                <View style={[styles.imageBig, styles.imageEmpty]}>
                  <Text style={styles.dim}>No image</Text>
                </View>
              )}
              <Pressable style={styles.btnGhost} onPress={uploadImage} disabled={uploading}>
                <Text style={styles.btnGhostText}>
                  {uploading ? 'Uploading…' : form.image_url ? 'Replace image' : 'Upload image'}
                </Text>
              </Pressable>
              {form.image_url ? (
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => setForm({ ...form, image_url: null })}
                >
                  <Text style={styles.btnGhostText}>Remove image</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ flex: 1, gap: 10, minWidth: 260 }}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="T-shirt, supplement, gear…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                multiline
                numberOfLines={3}
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              />

              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Price (USD)</Text>
                  <TextInput
                    value={form.price}
                    onChangeText={(v) =>
                      setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })
                    }
                    placeholder="29.99"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>SKU (optional)</Text>
                  <TextInput
                    value={form.sku}
                    onChangeText={(v) => setForm({ ...form, sku: v })}
                    placeholder="SKU-12345"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.label}>Category (optional)</Text>
              <TextInput
                value={form.category}
                onChangeText={(v) => setForm({ ...form, category: v })}
                placeholder="Apparel, Supplements, Gear…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              <Text style={styles.dim}>
                Shoppers can filter the public store by category.
              </Text>

              <Text style={styles.label}>Inventory location (private)</Text>
              <TextInput
                value={form.inventory_location}
                onChangeText={(v) => setForm({ ...form, inventory_location: v })}
                placeholder="Front desk shelf, back room bin 4…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              <Text style={styles.dim}>Only visible in your dashboard. Never shown publicly.</Text>

              <View style={styles.toggleInline}>
                <Switch
                  value={form.published}
                  onValueChange={(v) => setForm({ ...form, published: v })}
                />
                <Text style={styles.label}>Show on public store</Text>
              </View>
              <View style={styles.toggleInline}>
                <Switch
                  value={form.featured}
                  onValueChange={(v) => setForm({ ...form, featured: v })}
                />
                <Text style={styles.label}>Featured (pinned to the top)</Text>
              </View>
            </View>
          </View>

          <View style={styles.formButtons}>
            <Pressable style={styles.btn} onPress={save} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setForm(null)}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            {form.id ? (
              <Pressable style={styles.btnDanger} onPress={() => deleteProduct(form.id!)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.list}>
        <Text style={styles.sectionTitle}>
          Products ({products.length})
        </Text>
        {products.length === 0 ? (
          <Text style={styles.dim}>No products yet. Add one above.</Text>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.thumbWrap}>
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Text style={styles.dim}>No image</Text>
                    </View>
                  )}
                  {!p.published ? (
                    <View style={styles.unpubBadge}>
                      <Text style={styles.unpubBadgeText}>Hidden</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.cardPrice}>
                    {p.price_cents != null ? `$${(p.price_cents / 100).toFixed(2)}` : '—'}
                  </Text>
                  <View style={styles.tagRow}>
                    {p.featured ? (
                      <View style={styles.featTag}>
                        <Text style={styles.featTagText}>★ Featured</Text>
                      </View>
                    ) : null}
                    {p.category ? (
                      <View style={styles.catTag}>
                        <Text style={styles.catTagText}>{p.category}</Text>
                      </View>
                    ) : null}
                  </View>
                  {p.sku ? <Text style={styles.cardMeta}>SKU {p.sku}</Text> : null}
                  {p.inventory_location ? (
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      📍 {p.inventory_location}
                    </Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => edit(p)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => togglePublished(p)} style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>{p.published ? 'Hide' : 'Publish'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
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

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  statusLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  statusSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
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
    gap: 14,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  row: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  flex: { flex: 1, flexBasis: 160, gap: 6 },
  imageCol: { width: 200, gap: 8 },
  imageBig: { width: 200, height: 200, borderRadius: 10, backgroundColor: '#f1f5f9' },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
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
  toggleInline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  list: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: '100%', height: 160 },
  thumbEmpty: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  unpubBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.78)',
  },
  unpubBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  cardBody: { padding: 12, gap: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  cardPrice: { fontSize: 16, fontWeight: '800', color: theme.colors.wyldPurple },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 2 },
  featTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  featTagText: { fontSize: 10, fontWeight: '800', color: '#92400e' },
  catTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  catTagText: { fontSize: 10, fontWeight: '700', color: '#4338ca' },
  cardMeta: { fontSize: 12, color: theme.colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
});
