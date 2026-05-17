import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { pickAndUploadImages } from '@/components/ImageUpload';
import { Select } from '@/components/Select';

type Product = {
  id: string;
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
  inventory_qty: number | null;
  cost_cents: number | null;
  location_id: string | null;
};

type Loc = { id: string; label: string | null };

type Form = {
  id?: string;
  name: string;
  description: string;
  price: string;
  sku: string;
  inventory_location: string;
  image_url: string | null;
  published: boolean;
  category: string;
  featured: boolean;
  inventory_qty: string;
  cost: string;
  location_id: string | null;
};

const PAGE = 12;

const emptyForm = (locationId: string | null): Form => ({
  name: '',
  description: '',
  price: '',
  sku: '',
  inventory_location: '',
  image_url: null,
  published: true,
  category: '',
  featured: false,
  inventory_qty: '',
  cost: '',
  location_id: locationId,
});

export default function OwnerStore() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;

  const [products, setProducts] = useState<Product[] | null>(null);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [multiLocation, setMultiLocation] = useState(false);
  const [storeEnabled, setStoreEnabled] = useState<boolean | null>(null);
  const [storeVisible, setStoreVisible] = useState(true);

  const [view, setView] = useState<'products' | 'inventory'>('products');
  const [search, setSearch] = useState('');
  const [locFilter, setLocFilter] = useState<string | null>(null); // null = all
  const [visible, setVisible] = useState(PAGE);

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: m }, { data: prods, error }, { data: locs }] = await Promise.all([
      supabase
        .from('gym_modules')
        .select('store_enabled, store_visible, multi_location_enabled')
        .eq('gym_id', gymId)
        .maybeSingle(),
      supabase.from('gym_products').select('*').eq('gym_id', gymId).order('display_order'),
      supabase
        .from('gym_locations')
        .select('id, label')
        .eq('gym_id', gymId)
        .order('display_order'),
    ]);
    setStoreEnabled(!!(m as any)?.store_enabled);
    setStoreVisible(!!(m as any)?.store_visible);
    setMultiLocation(!!(m as any)?.multi_location_enabled);
    setLocations((locs as Loc[]) ?? []);
    if (error) setErr(error.message);
    setProducts((prods as Product[]) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // Infinite scroll on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
      if (nearBottom) setVisible((v) => v + PAGE);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setVisible(PAGE);
  }, [search, locFilter, view]);

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (locFilter) list = list.filter((p) => p.location_id === locFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const price = p.price_cents != null ? (p.price_cents / 100).toFixed(2) : '';
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          price.includes(q)
        );
      });
    }
    return list;
  }, [products, search, locFilter]);

  const shown = filtered.slice(0, visible);

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
    let costCents: number | null = null;
    if (form.cost.trim()) {
      const n = Number(form.cost);
      if (!Number.isFinite(n) || n < 0) {
        setErr('Cost must be a positive number, or blank.');
        return;
      }
      costCents = Math.round(n * 100);
    }
    const qty = form.inventory_qty.trim() === '' ? null : parseInt(form.inventory_qty, 10);
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
      inventory_qty: qty,
      cost_cents: costCents,
      location_id: form.location_id,
    };
    setSaving(true);
    const res = form.id
      ? await supabase.from('gym_products').update(payload).eq('id', form.id)
      : await supabase
          .from('gym_products')
          .insert({ ...payload, display_order: products?.length ?? 0 });
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
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
    setForm(null);
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

  // Inventory inline edits — update local + persist.
  async function updateInventory(id: string, patch: { inventory_qty?: number | null; cost_cents?: number | null }) {
    setProducts((products ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('gym_products').update(patch).eq('id', id);
    if (error) setErr(error.message);
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
      inventory_qty: p.inventory_qty != null ? String(p.inventory_qty) : '',
      cost: p.cost_cents != null ? (p.cost_cents / 100).toFixed(2) : '',
      location_id: p.location_id,
    });
    setView('products');
  }

  const locName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.label ?? 'Location' : 'Shared';

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
          Products, prices, and inventory. Published products show on your public site;
          inventory and cost stay private.
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusLabel}>Show Store on public site</Text>
        </View>
        <Switch value={storeVisible} onValueChange={toggleStoreVisible} />
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {/* View toggle + add */}
      <View style={styles.topBar}>
        <View style={styles.viewToggle}>
          {(['products', 'inventory'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.viewBtn, view === v && styles.viewBtnActive]}
            >
              <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
                {v === 'products' ? 'Products' : 'Inventory'}
              </Text>
            </Pressable>
          ))}
        </View>
        {!form ? (
          <Pressable
            style={styles.btn}
            onPress={() => {
              setForm(emptyForm(locFilter));
              setView('products');
            }}
          >
            <Text style={styles.btnText}>+ Add product</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Location filter */}
      {multiLocation && locations.length > 0 ? (
        <View style={styles.filterField}>
          <Text style={styles.label}>Location</Text>
          <Select
            ariaLabel="Filter by location"
            value={locFilter ?? 'all'}
            onChange={(v) => setLocFilter(v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
            ]}
          />
        </View>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, price, SKU, or category…"
        placeholderTextColor="#94a3b8"
        style={styles.search}
      />

      {/* Add/edit form */}
      {form ? (
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
                <Pressable style={styles.btnGhost} onPress={() => setForm({ ...form, image_url: null })}>
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
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Price (USD)</Text>
                  <TextInput
                    value={form.price}
                    onChangeText={(v) => setForm({ ...form, price: v.replace(/[^0-9.]/g, '') })}
                    placeholder="29.99"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>SKU</Text>
                  <TextInput
                    value={form.sku}
                    onChangeText={(v) => setForm({ ...form, sku: v })}
                    placeholder="SKU-12345"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>On-hand quantity</Text>
                  <TextInput
                    value={form.inventory_qty}
                    onChangeText={(v) =>
                      setForm({ ...form, inventory_qty: v.replace(/[^0-9]/g, '') })
                    }
                    placeholder="e.g. 24"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Your cost per unit (USD)</Text>
                  <TextInput
                    value={form.cost}
                    onChangeText={(v) => setForm({ ...form, cost: v.replace(/[^0-9.]/g, '') })}
                    placeholder="12.50"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.label}>Category</Text>
              <TextInput
                value={form.category}
                onChangeText={(v) => setForm({ ...form, category: v })}
                placeholder="Apparel, Supplements, Gear…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              <Text style={styles.label}>Inventory location / storage (private)</Text>
              <TextInput
                value={form.inventory_location}
                onChangeText={(v) => setForm({ ...form, inventory_location: v })}
                placeholder="Front desk shelf, back room bin 4…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              {multiLocation && locations.length > 0 ? (
                <>
                  <Text style={styles.label}>Sells at</Text>
                  <Select
                    ariaLabel="Sells at location"
                    value={form.location_id ?? 'shared'}
                    onChange={(v) =>
                      setForm({ ...form, location_id: v === 'shared' ? null : v })
                    }
                    options={[
                      { value: 'shared', label: 'All locations (shared)' },
                      ...locations.map((l) => ({
                        value: l.id,
                        label: l.label || 'Location',
                      })),
                    ]}
                    fullWidth
                  />
                </>
              ) : null}

              <View style={styles.toggleInline}>
                <Switch value={form.published} onValueChange={(v) => setForm({ ...form, published: v })} />
                <Text style={styles.label}>Show on public store</Text>
              </View>
              <View style={styles.toggleInline}>
                <Switch value={form.featured} onValueChange={(v) => setForm({ ...form, featured: v })} />
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
      ) : null}

      {/* PRODUCTS view */}
      {view === 'products' ? (
        filtered.length === 0 ? (
          <Text style={styles.dim}>
            {search || locFilter ? 'No products match.' : 'No products yet. Add one above.'}
          </Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
            </Text>
            <View style={styles.grid}>
              {shown.map((p) => (
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
                      {multiLocation ? (
                        <View style={styles.locTag}>
                          <Text style={styles.locTagText}>{locName(p.location_id)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.cardMeta}>
                      {p.inventory_qty != null ? `${p.inventory_qty} in stock` : 'Stock not set'}
                      {p.sku ? ` · ${p.sku}` : ''}
                    </Text>
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
            {visible < filtered.length ? (
              <Pressable style={styles.loadMore} onPress={() => setVisible((v) => v + PAGE)}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </Pressable>
            ) : null}
          </>
        )
      ) : null}

      {/* INVENTORY view */}
      {view === 'inventory' ? (
        filtered.length === 0 ? (
          <Text style={styles.dim}>No products to track.</Text>
        ) : (
          <View style={styles.invTable}>
            <View style={[styles.invRow, styles.invHead]}>
              <Text style={[styles.invCell, styles.invName, styles.invHeadText]}>Product</Text>
              <Text style={[styles.invCell, styles.invQtyCol, styles.invHeadText]}>On hand</Text>
              <Text style={[styles.invCell, styles.invQtyCol, styles.invHeadText]}>Unit cost</Text>
              <Text style={[styles.invCell, styles.invQtyCol, styles.invHeadText]}>Stock value</Text>
            </View>
            {shown.map((p) => {
              const value =
                p.inventory_qty != null && p.cost_cents != null
                  ? (p.inventory_qty * p.cost_cents) / 100
                  : null;
              return (
                <View key={p.id} style={styles.invRow}>
                  <View style={[styles.invCell, styles.invName]}>
                    <Text style={styles.invNameText} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.invSub} numberOfLines={1}>
                      {p.sku ? `${p.sku} · ` : ''}
                      {multiLocation ? locName(p.location_id) : p.category || ''}
                    </Text>
                  </View>
                  <View style={[styles.invCell, styles.invQtyCol]}>
                    <TextInput
                      defaultValue={p.inventory_qty != null ? String(p.inventory_qty) : ''}
                      onEndEditing={(e) => {
                        const raw = e.nativeEvent.text.replace(/[^0-9]/g, '');
                        updateInventory(p.id, {
                          inventory_qty: raw === '' ? null : parseInt(raw, 10),
                        });
                      }}
                      placeholder="—"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      style={styles.invInput}
                    />
                  </View>
                  <View style={[styles.invCell, styles.invQtyCol]}>
                    <TextInput
                      defaultValue={p.cost_cents != null ? (p.cost_cents / 100).toFixed(2) : ''}
                      onEndEditing={(e) => {
                        const raw = e.nativeEvent.text.replace(/[^0-9.]/g, '');
                        updateInventory(p.id, {
                          cost_cents: raw === '' ? null : Math.round(Number(raw) * 100),
                        });
                      }}
                      placeholder="—"
                      placeholderTextColor="#94a3b8"
                      keyboardType="decimal-pad"
                      style={styles.invInput}
                    />
                  </View>
                  <Text style={[styles.invCell, styles.invQtyCol, styles.invValue]}>
                    {value != null ? `$${value.toFixed(2)}` : '—'}
                  </Text>
                </View>
              );
            })}
            {visible < filtered.length ? (
              <Pressable style={styles.loadMore} onPress={() => setVisible((v) => v + PAGE)}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </Pressable>
            ) : null}
          </View>
        )
      ) : null}
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
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textSecondary },

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

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  viewBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  viewBtnActive: { backgroundColor: theme.colors.wyldPurple },
  viewBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  viewBtnTextActive: { color: '#fff' },

  filterField: { gap: 4, alignSelf: 'flex-start' },
  locRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  locChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  locChipActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  locChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  locChipTextActive: { color: '#fff' },

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

  btn: {
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
  flex: { flex: 1, flexBasis: 160, gap: 6, minWidth: 150 },
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
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  selPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  selPillActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  selPillText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  selPillTextActive: { color: '#fff' },
  toggleInline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

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
  featTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#fef3c7' },
  featTagText: { fontSize: 10, fontWeight: '800', color: '#92400e' },
  catTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#eef2ff' },
  catTagText: { fontSize: 10, fontWeight: '700', color: '#4338ca' },
  locTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#ecfdf5' },
  locTagText: { fontSize: 10, fontWeight: '700', color: '#047857' },
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

  loadMore: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },

  invTable: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  invHead: { backgroundColor: '#f8fafc' },
  invHeadText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  invCell: { paddingHorizontal: 10, paddingVertical: 10 },
  invName: { flex: 1, minWidth: 120 },
  invNameText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  invSub: { fontSize: 11, color: theme.colors.textSecondary },
  invQtyCol: { width: 110 },
  invInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  invValue: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
});
