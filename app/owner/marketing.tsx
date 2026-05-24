import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useGymTheme } from '@/lib/gymTheme';
import { pickAndUploadImages } from '@/components/ImageUpload';

type Asset = {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  image_url: string;
  display_order: number;
  created_at: string;
};

export default function OwnerMarketing() {
  const { profile } = useAuth();
  const gymTheme = useGymTheme();
  const gymId = profile?.gym_id ?? null;
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [marketingEnabled, setMarketingEnabled] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: m }, { data: a, error }] = await Promise.all([
      supabase
        .from('gym_modules')
        .select('marketing_enabled')
        .eq('gym_id', gymId)
        .maybeSingle(),
      supabase
        .from('gym_marketing_assets')
        .select('*')
        .eq('gym_id', gymId)
        .order('display_order'),
    ]);
    setMarketingEnabled(!!(m as any)?.marketing_enabled);
    if (error) setErr(error.message);
    setAssets((a as Asset[]) ?? []);
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!gymId) return;
    setUploading(true);
    setErr(null);
    const urls = await pickAndUploadImages(gymId, { multiple: true });
    if (urls.length === 0) {
      setUploading(false);
      return;
    }
    const startOrder = assets?.length ?? 0;
    const rows = urls.map((url, i) => ({
      gym_id: gymId,
      name: 'Untitled asset',
      image_url: url,
      display_order: startOrder + i,
    }));
    const { error } = await supabase.from('gym_marketing_assets').insert(rows);
    setUploading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  async function update(id: string, patch: Partial<Asset>) {
    setAssets((assets ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from('gym_marketing_assets').update(patch).eq('id', id);
    if (error) setErr(error.message);
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this asset?')) return;
    const { error } = await supabase.from('gym_marketing_assets').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  function download(a: Asset) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(a.image_url, '_blank');
    }
  }

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Marketing Materials</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }

  if (assets === null || marketingEnabled === null) {
    return <ActivityIndicator color={theme.colors.charcoal} />;
  }

  if (!marketingEnabled) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Marketing Materials</Text>
        <Text style={styles.dim}>The Marketing Materials module isn&apos;t enabled for your gym.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Marketing Materials</Text>
        <Text style={styles.sub}>
          Your private library of images: flyers, social posts, signage, logos. Upload
          here, then download the files when you need them.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable style={[styles.btn, { backgroundColor: gymTheme.accent }]} onPress={add} disabled={uploading}>
        <Text style={styles.btnText}>
          {uploading ? 'Uploading…' : '+ Upload images'}
        </Text>
      </Pressable>

      {assets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.dim}>
            No assets yet. Upload your first one above. You can upload multiple at once.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {assets.map((a) => (
            <View key={a.id} style={styles.card}>
              <Pressable onPress={() => download(a)}>
                <Image source={{ uri: a.image_url }} style={styles.thumb} resizeMode="cover" />
              </Pressable>
              <View style={styles.cardBody}>
                <TextInput
                  value={a.name}
                  onChangeText={(v) =>
                    setAssets((assets ?? []).map((x) => (x.id === a.id ? { ...x, name: v } : x)))
                  }
                  onBlur={() => update(a.id, { name: a.name })}
                  placeholder="Name this asset"
                  placeholderTextColor="#94a3b8"
                  style={styles.nameInput}
                />
                <TextInput
                  value={a.description ?? ''}
                  onChangeText={(v) =>
                    setAssets(
                      (assets ?? []).map((x) =>
                        x.id === a.id ? { ...x, description: v } : x
                      )
                    )
                  }
                  onBlur={() => update(a.id, { description: a.description })}
                  placeholder="Description (where it's used, sizes, etc.)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                  style={[styles.descInput, { textAlignVertical: 'top' }]}
                />
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionBtn} onPress={() => download(a)}>
                    <Text style={styles.actionBtnText}>Download</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtnDanger} onPress={() => remove(a.id)}>
                    <Text style={styles.actionBtnDangerText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
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

  emptyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#f8fafc',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: {
    width: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: 180, backgroundColor: '#f1f5f9' },
  cardBody: { padding: 10, gap: 6 },
  nameInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  descInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 50,
    fontSize: 13,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  actionBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionBtnDangerText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
});
