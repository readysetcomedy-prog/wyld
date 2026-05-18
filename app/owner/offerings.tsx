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
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import {
  BillingPeriod,
  BILLING_PERIODS,
  isRecurring,
  periodNoun,
  periodUnitLabel,
  countOptions,
  countLabel,
  termLabel,
  termDiscount,
  money,
} from '@/lib/pricing';

// New prepay options are { count, price_cents }. Legacy rows may instead
// carry a free-text { label, price_cents } — kept readable but not editable.
type TermOption = { count?: number; price_cents: number; label?: string };

type Offering = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  published: boolean;
  featured: boolean;
  billing_period: BillingPeriod;
  public_blurb: string | null;
  perks: string[] | null;
  term_options: TermOption[] | null;
  location_id: string | null;
  display_order: number;
};

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  published: boolean;
  featured: boolean;
  billing_period: BillingPeriod;
  public_blurb: string | null;
  perks: string[] | null;
  display_order: number;
  offeringIds: string[];
};

type TermRow = { count: number; price: string };

type OfferingForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  published: boolean;
  featured: boolean;
  billing_period: BillingPeriod;
  public_blurb: string;
  perks: string[];
  terms: TermRow[];
  location_id: string | null;
};

type PkgForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  published: boolean;
  featured: boolean;
  billing_period: BillingPeriod;
  public_blurb: string;
  perks: string[];
  offeringIds: string[];
};

const dollars = (cents: number | null) =>
  cents != null ? `$${(cents / 100).toFixed(2)}` : '—';
const toCents = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

export default function OwnerOfferings() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;

  const [offerings, setOfferings] = useState<Offering[] | null>(null);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [view, setView] = useState<'offerings' | 'packages'>('offerings');
  const [oForm, setOForm] = useState<OfferingForm | null>(null);
  const [pForm, setPForm] = useState<PkgForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; label: string | null }[]>([]);
  const [multiLocation, setMultiLocation] = useState(false);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: o }, { data: p }, { data: links }, { data: mod }, { data: locs }] =
      await Promise.all([
        supabase.from('gym_offerings').select('*').eq('gym_id', gymId).order('display_order'),
        supabase.from('gym_packages').select('*').eq('gym_id', gymId).order('display_order'),
        supabase.from('gym_package_offerings').select('package_id, offering_id'),
        supabase
          .from('gym_modules')
          .select('multi_location_enabled')
          .eq('gym_id', gymId)
          .maybeSingle(),
        supabase
          .from('gym_locations')
          .select('id, label')
          .eq('gym_id', gymId)
          .order('display_order'),
      ]);
    setMultiLocation(!!(mod as any)?.multi_location_enabled);
    setLocations((locs as any) ?? []);
    setOfferings((o as Offering[]) ?? []);
    const byPkg: Record<string, string[]> = {};
    (links ?? []).forEach((l: any) => {
      (byPkg[l.package_id] ??= []).push(l.offering_id);
    });
    setPackages(((p as any[]) ?? []).map((row) => ({ ...row, offeringIds: byPkg[row.id] ?? [] })));
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Offerings ----
  async function saveOffering() {
    if (!oForm || !gymId) return;
    setErr(null);
    if (!oForm.name.trim()) {
      setErr('Name is required.');
      return;
    }
    const price = toCents(oForm.price);
    if (Number.isNaN(price)) {
      setErr('Price must be a positive number, or blank.');
      return;
    }
    const terms: TermOption[] = [];
    if (isRecurring(oForm.billing_period)) {
      for (const t of oForm.terms) {
        const c = toCents(t.price);
        if (c == null || Number.isNaN(c)) {
          setErr('Each prepay option needs a total price.');
          return;
        }
        terms.push({ count: t.count, price_cents: c });
      }
    }
    const perks = oForm.perks.map((p) => p.trim()).filter(Boolean);
    const payload: any = {
      gym_id: gymId,
      name: oForm.name.trim(),
      description: oForm.description.trim() || null,
      price_cents: price,
      published: oForm.published,
      featured: oForm.featured,
      billing_period: oForm.billing_period,
      public_blurb: oForm.public_blurb.trim() || null,
      perks: perks.length > 0 ? perks : null,
      term_options: terms.length > 0 ? terms : null,
      location_id: oForm.location_id,
    };
    setSaving(true);
    const res = oForm.id
      ? await supabase.from('gym_offerings').update(payload).eq('id', oForm.id)
      : await supabase
          .from('gym_offerings')
          .insert({ ...payload, display_order: offerings?.length ?? 0 });
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setOForm(null);
    load();
  }

  async function deleteOffering(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this offering?')) return;
    const { error } = await supabase.from('gym_offerings').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setOForm(null);
    load();
  }

  // ---- Packages ----
  async function savePackage() {
    if (!pForm || !gymId) return;
    setErr(null);
    if (!pForm.name.trim()) {
      setErr('Package name is required.');
      return;
    }
    const price = toCents(pForm.price);
    if (Number.isNaN(price)) {
      setErr('Price must be a positive number, or blank.');
      return;
    }
    const perks = pForm.perks.map((p) => p.trim()).filter(Boolean);
    const payload: any = {
      gym_id: gymId,
      name: pForm.name.trim(),
      description: pForm.description.trim() || null,
      price_cents: price,
      published: pForm.published,
      featured: pForm.featured,
      billing_period: pForm.billing_period,
      public_blurb: pForm.public_blurb.trim() || null,
      perks: perks.length > 0 ? perks : null,
    };
    setSaving(true);
    let pkgId = pForm.id;
    if (pkgId) {
      const { error } = await supabase.from('gym_packages').update(payload).eq('id', pkgId);
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('gym_packages')
        .insert({ ...payload, display_order: packages.length })
        .select('id')
        .single();
      if (error) {
        setErr(error.message);
        setSaving(false);
        return;
      }
      pkgId = (data as any).id;
    }
    await supabase.from('gym_package_offerings').delete().eq('package_id', pkgId);
    if (pForm.offeringIds.length > 0) {
      await supabase.from('gym_package_offerings').insert(
        pForm.offeringIds.map((oid) => ({ package_id: pkgId, offering_id: oid }))
      );
    }
    setSaving(false);
    setPForm(null);
    load();
  }

  async function deletePackage(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this package?')) return;
    const { error } = await supabase.from('gym_packages').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setPForm(null);
    load();
  }

  const offeringById = useMemo(() => {
    const m: Record<string, Offering> = {};
    (offerings ?? []).forEach((o) => {
      m[o.id] = o;
    });
    return m;
  }, [offerings]);

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
        <Text style={styles.title}>Offerings &amp; Packages</Text>
        <Text style={styles.sub}>
          Memberships, passes, and bundles you sell. Set how each one shows on your public
          site, add prepay discounts, and combine offerings into packages.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.topBar}>
        <View style={styles.viewToggle}>
          {(['offerings', 'packages'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[styles.viewBtn, view === v && styles.viewBtnActive]}
            >
              <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
                {v === 'offerings' ? 'Offerings' : 'Packages'}
              </Text>
            </Pressable>
          ))}
        </View>
        {view === 'offerings' && !oForm ? (
          <Pressable
            style={styles.btn}
            onPress={() =>
              setOForm({
                name: '',
                description: '',
                price: '',
                published: true,
                featured: false,
                billing_period: 'month',
                public_blurb: '',
                perks: [],
                terms: [],
                location_id: null,
              })
            }
          >
            <Text style={styles.btnText}>+ Add offering</Text>
          </Pressable>
        ) : null}
        {view === 'packages' && !pForm ? (
          <Pressable
            style={styles.btn}
            onPress={() =>
              setPForm({
                name: '',
                description: '',
                price: '',
                published: true,
                featured: false,
                billing_period: 'month',
                public_blurb: '',
                perks: [],
                offeringIds: [],
              })
            }
          >
            <Text style={styles.btnText}>+ Add package</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---------- OFFERING FORM ---------- */}
      {view === 'offerings' && oForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{oForm.id ? 'Edit' : 'New'} offering</Text>
          <Field label="Name" value={oForm.name} onChange={(v) => setOForm({ ...oForm, name: v })}
            placeholder="Monthly Yoga Pass" />
          <Field label="Description" value={oForm.description} multiline
            onChange={(v) => setOForm({ ...oForm, description: v })}
            placeholder="What's included…" />
          <Field label="Base price (USD)" value={oForm.price} keyboard="decimal-pad"
            onChange={(v) => setOForm({ ...oForm, price: v.replace(/[^0-9.]/g, '') })}
            placeholder="49.00" />

          {multiLocation && locations.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.label}>Location</Text>
              <Select
                ariaLabel="Offering location"
                value={oForm.location_id ?? 'all'}
                onChange={(v) =>
                  setOForm({ ...oForm, location_id: v === 'all' ? null : v })
                }
                options={[
                  { value: 'all', label: 'All locations' },
                  ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
                ]}
              />
              <Text style={styles.dim}>
                Price this offering for one location, or keep it on all of them.
              </Text>
            </View>
          ) : null}

          <PerksEditor
            perks={oForm.perks}
            onChange={(perks) => setOForm({ ...oForm, perks })}
          />

          <SiteSection
            published={oForm.published}
            featured={oForm.featured}
            billingPeriod={oForm.billing_period}
            blurb={oForm.public_blurb}
            onPublished={(b) => setOForm({ ...oForm, published: b })}
            onFeatured={(b) => setOForm({ ...oForm, featured: b })}
            onPeriod={(v) => setOForm({ ...oForm, billing_period: v })}
            onBlurb={(v) => setOForm({ ...oForm, public_blurb: v })}
          />

          {isRecurring(oForm.billing_period) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prepay &amp; discount options</Text>
              <Text style={styles.sectionHint}>
                Add cheaper rates for paying several {periodNoun(oForm.billing_period)}s
                upfront. Pick how many {periodNoun(oForm.billing_period)}s and the total
                price — your site shows the % saved and the per-
                {periodNoun(oForm.billing_period)} rate automatically.
              </Text>
              {oForm.terms.map((t, i) => (
                <View key={i} style={styles.termBlock}>
                  <View style={styles.termRow}>
                    <Select
                      ariaLabel="Number of periods"
                      value={String(t.count)}
                      onChange={(v) =>
                        setOForm({
                          ...oForm,
                          terms: oForm.terms.map((x, j) =>
                            j === i ? { ...x, count: Number(v) } : x
                          ),
                        })
                      }
                      options={countOptions(oForm.billing_period).map((n) => ({
                        value: String(n),
                        label: countLabel(oForm.billing_period, n),
                      }))}
                    />
                    <TextInput
                      value={t.price}
                      onChangeText={(v) =>
                        setOForm({
                          ...oForm,
                          terms: oForm.terms.map((x, j) =>
                            j === i ? { ...x, price: v.replace(/[^0-9.]/g, '') } : x
                          ),
                        })
                      }
                      placeholder="Total $"
                      placeholderTextColor="#94a3b8"
                      keyboardType="decimal-pad"
                      style={[styles.input, { flex: 1, minWidth: 90 }]}
                    />
                    <Pressable
                      onPress={() =>
                        setOForm({ ...oForm, terms: oForm.terms.filter((_, j) => j !== i) })
                      }
                      style={styles.iconBtn}
                    >
                      <Text style={styles.iconBtnText}>×</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.termPreview}>{termPreview(oForm, t)}</Text>
                </View>
              ))}
              <Pressable
                style={styles.btnSmall}
                onPress={() =>
                  setOForm({
                    ...oForm,
                    terms: [
                      ...oForm.terms,
                      { count: countOptions(oForm.billing_period)[0], price: '' },
                    ],
                  })
                }
              >
                <Text style={styles.btnSmallText}>+ Add prepay option</Text>
              </Pressable>
            </View>
          ) : null}

          <FormButtons
            saving={saving}
            onSave={saveOffering}
            onCancel={() => setOForm(null)}
            onDelete={oForm.id ? () => deleteOffering(oForm.id!) : undefined}
          />
        </View>
      ) : null}

      {/* ---------- PACKAGE FORM ---------- */}
      {view === 'packages' && pForm ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{pForm.id ? 'Edit' : 'New'} package</Text>
          <Field label="Package name" value={pForm.name}
            onChange={(v) => setPForm({ ...pForm, name: v })}
            placeholder="Yoga + Strength Bundle" />
          <Field label="Description" value={pForm.description} multiline
            onChange={(v) => setPForm({ ...pForm, description: v })}
            placeholder="What's in the bundle…" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Included offerings</Text>
            {(offerings ?? []).length === 0 ? (
              <Text style={styles.dim}>Add offerings first, then bundle them here.</Text>
            ) : (
              (offerings ?? []).map((o) => {
                const on = pForm.offeringIds.includes(o.id);
                return (
                  <Pressable
                    key={o.id}
                    style={styles.checkRow}
                    onPress={() =>
                      setPForm({
                        ...pForm,
                        offeringIds: on
                          ? pForm.offeringIds.filter((x) => x !== o.id)
                          : [...pForm.offeringIds, o.id],
                      })
                    }
                  >
                    <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.checkLabel}>
                      {o.name} <Text style={styles.dim}>· {dollars(o.price_cents)}</Text>
                    </Text>
                  </Pressable>
                );
              })
            )}
            {pForm.offeringIds.length > 0 ? (
              <Text style={styles.sectionHint}>
                Regular total:{' '}
                {dollars(
                  pForm.offeringIds.reduce(
                    (sum, id) => sum + (offeringById[id]?.price_cents ?? 0),
                    0
                  )
                )}
                . Set a lower package price below — the site shows the savings.
              </Text>
            ) : null}
          </View>

          <Field label="Package price (USD)" value={pForm.price} keyboard="decimal-pad"
            onChange={(v) => setPForm({ ...pForm, price: v.replace(/[^0-9.]/g, '') })}
            placeholder="79.00" />

          <PerksEditor
            perks={pForm.perks}
            onChange={(perks) => setPForm({ ...pForm, perks })}
          />

          <SiteSection
            published={pForm.published}
            featured={pForm.featured}
            billingPeriod={pForm.billing_period}
            blurb={pForm.public_blurb}
            onPublished={(b) => setPForm({ ...pForm, published: b })}
            onFeatured={(b) => setPForm({ ...pForm, featured: b })}
            onPeriod={(v) => setPForm({ ...pForm, billing_period: v })}
            onBlurb={(v) => setPForm({ ...pForm, public_blurb: v })}
          />

          <FormButtons
            saving={saving}
            onSave={savePackage}
            onCancel={() => setPForm(null)}
            onDelete={pForm.id ? () => deletePackage(pForm.id!) : undefined}
          />
        </View>
      ) : null}

      {/* ---------- LISTS ---------- */}
      {view === 'offerings' && !oForm ? (
        offerings.length === 0 ? (
          <Text style={styles.dim}>No offerings yet. Add your first one above.</Text>
        ) : (
          <View style={styles.list}>
            {offerings.map((o) => (
              <View key={o.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>
                    {o.name}
                    {o.featured ? '  ★' : ''}
                    {!o.published ? '  (hidden)' : ''}
                  </Text>
                  {o.description ? <Text style={styles.cardDesc}>{o.description}</Text> : null}
                  {multiLocation ? (
                    <Text style={styles.cardMeta}>
                      {o.location_id
                        ? locations.find((l) => l.id === o.location_id)?.label || 'Location'
                        : 'All locations'}
                    </Text>
                  ) : null}
                  {o.term_options && o.term_options.length > 0 ? (
                    <Text style={styles.cardMeta}>
                      {o.term_options.length} prepay option
                      {o.term_options.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  {o.perks && o.perks.length > 0 ? (
                    <Text style={styles.cardMeta}>
                      {o.perks.length} included item{o.perks.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cardPrice}>
                  {dollars(o.price_cents)}
                  <Text style={styles.cardUnit}>{periodUnitLabel(o.billing_period)}</Text>
                </Text>
                <Pressable
                  onPress={() =>
                    setOForm({
                      id: o.id,
                      name: o.name,
                      description: o.description ?? '',
                      price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '',
                      published: o.published,
                      featured: o.featured,
                      billing_period: o.billing_period ?? 'month',
                      public_blurb: o.public_blurb ?? '',
                      perks: o.perks ?? [],
                      terms: (o.term_options ?? []).map((t) => ({
                        count: t.count ?? 2,
                        price: (t.price_cents / 100).toFixed(2),
                      })),
                      location_id: o.location_id ?? null,
                    })
                  }
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : null}

      {view === 'packages' && !pForm ? (
        packages.length === 0 ? (
          <Text style={styles.dim}>No packages yet. Bundle offerings into a package above.</Text>
        ) : (
          <View style={styles.list}>
            {packages.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>
                    {p.name}
                    {p.featured ? '  ★' : ''}
                    {!p.published ? '  (hidden)' : ''}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {p.offeringIds
                      .map((id) => offeringById[id]?.name)
                      .filter(Boolean)
                      .join(' + ') || 'No offerings attached'}
                  </Text>
                </View>
                <Text style={styles.cardPrice}>
                  {dollars(p.price_cents)}
                  <Text style={styles.cardUnit}>{periodUnitLabel(p.billing_period)}</Text>
                </Text>
                <Pressable
                  onPress={() =>
                    setPForm({
                      id: p.id,
                      name: p.name,
                      description: p.description ?? '',
                      price: p.price_cents != null ? (p.price_cents / 100).toFixed(2) : '',
                      published: p.published,
                      featured: p.featured,
                      billing_period: p.billing_period ?? 'month',
                      public_blurb: p.public_blurb ?? '',
                      perks: p.perks ?? [],
                      offeringIds: p.offeringIds,
                    })
                  }
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

// Live preview shown under a prepay option in the editor.
function termPreview(form: OfferingForm, t: TermRow): string {
  const label = termLabel(form.billing_period, t.count);
  const total = toCents(t.price);
  if (total == null || Number.isNaN(total)) return `${label} — enter a total price.`;
  const base = toCents(form.price);
  if (base == null) {
    return `${label}: ${money(total)} — add a base price above to show a discount.`;
  }
  if (Number.isNaN(base)) return `${label}: ${money(total)}.`;
  const d = termDiscount(base, t.count, total);
  if (d.pct == null) {
    return `${label}: ${money(total)} — no saving vs ${money(d.regularCents)} regular.`;
  }
  return `${label}: ${money(d.regularCents)} → ${money(total)}  ·  ${d.pctText}% off  ·  ${money(
    d.perPeriodCents
  )}${periodUnitLabel(form.billing_period)}`;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'decimal-pad';
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        keyboardType={keyboard}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function PerksEditor({
  perks,
  onChange,
}: {
  perks: string[];
  onChange: (perks: string[]) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What&apos;s included</Text>
      <Text style={styles.sectionHint}>
        Each line shows as a ✓ checkmark on your public site. Add as many as you like.
      </Text>
      {perks.map((p, i) => (
        <View key={i} style={styles.termRow}>
          <Text style={styles.perkCheck}>✓</Text>
          <TextInput
            value={p}
            onChangeText={(v) => onChange(perks.map((x, j) => (j === i ? v : x)))}
            placeholder="e.g. Unlimited group classes"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { flex: 1, minWidth: 150 }]}
          />
          <Pressable
            onPress={() => onChange(perks.filter((_, j) => j !== i))}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.btnSmall} onPress={() => onChange([...perks, ''])}>
        <Text style={styles.btnSmallText}>+ Add item</Text>
      </Pressable>
    </View>
  );
}

function SiteSection({
  published,
  featured,
  billingPeriod,
  blurb,
  onPublished,
  onFeatured,
  onPeriod,
  onBlurb,
}: {
  published: boolean;
  featured: boolean;
  billingPeriod: BillingPeriod;
  blurb: string;
  onPublished: (b: boolean) => void;
  onFeatured: (b: boolean) => void;
  onPeriod: (v: BillingPeriod) => void;
  onBlurb: (v: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How it shows on your site</Text>
      <Text style={styles.sectionHint}>
        Controls how this appears on your public website. (Visible to gyms with the
        website package.)
      </Text>
      <View style={styles.toggleRow}>
        <Switch value={published} onValueChange={onPublished} />
        <Text style={styles.label}>Show on public site</Text>
      </View>
      <View style={styles.toggleRow}>
        <Switch value={featured} onValueChange={onFeatured} />
        <Text style={styles.label}>Featured (highlighted on the site)</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Billing period</Text>
        <View style={styles.pillRow}>
          {BILLING_PERIODS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => onPeriod(p.value)}
              style={[styles.periodPill, billingPeriod === p.value && styles.periodPillActive]}
            >
              <Text
                style={[
                  styles.periodPillText,
                  billingPeriod === p.value && styles.periodPillTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Field
        label="Marketing line (optional)"
        value={blurb}
        onChange={onBlurb}
        placeholder="Best value for committed members"
      />
    </View>
  );
}

function FormButtons({
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.formButtons}>
      <Pressable style={styles.btn} onPress={onSave} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
      <Pressable style={styles.btnGhost} onPress={onCancel}>
        <Text style={styles.btnGhostText}>Cancel</Text>
      </Pressable>
      {onDelete ? (
        <Pressable style={styles.btnDanger} onPress={onDelete}>
          <Text style={styles.btnDangerText}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },

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

  btn: {
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
  btnSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSmallText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },

  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
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
  section: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  sectionHint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  periodPillActive: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  periodPillText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  periodPillTextActive: { color: '#fff' },
  termBlock: { gap: 4 },
  termRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  termPreview: { fontSize: 12, color: theme.colors.wyldPurple, fontWeight: '600' },
  perkCheck: { fontSize: 15, fontWeight: '900', color: '#16a34a' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18, color: theme.colors.charcoal, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  checkLabel: { fontSize: 14, color: theme.colors.charcoal },
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
  cardMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: theme.colors.wyldPurple },
  cardUnit: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
});
