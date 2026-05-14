import { useEffect, useState } from 'react';
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
import { DEFAULT_BASE_URL } from '@/lib/appSettings';

export default function Settings() {
  const [baseUrl, setBaseUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('base_url')
        .eq('id', 1)
        .maybeSingle();
      setBaseUrl(data?.base_url ?? DEFAULT_BASE_URL);
      setLoaded(true);
    })();
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(trimmed)) {
      setError('Must look like https://yourdomain.com');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ base_url: trimmed })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBaseUrl(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!loaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }

  const samplePath = `${baseUrl.replace(/\/$/, '')}/g/bear-gym`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Base URL</Text>
        <Text style={styles.cardSub}>
          The host every gym site is served from. Used to compute the live URL on each
          gym (<Text style={styles.mono}>{`{base}/g/{slug}`}</Text>). When you move off
          the temporary URL, update this and every gym's live URL follows.
        </Text>
        <View style={styles.field}>
          <Text style={styles.label}>Base URL</Text>
          <TextInput
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://yourdomain.com"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={styles.hint}>
            No trailing slash. Example sample link: <Text style={styles.mono}>{samplePath}</Text>
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Saved.</Text> : null}
        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.lg, maxWidth: 720 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  cardSub: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  hint: { fontSize: 12, color: theme.colors.textSecondary },
  mono: { fontFamily: 'monospace' },
  error: { color: theme.colors.danger, fontSize: 13 },
  saved: { color: theme.colors.tealDark, fontSize: 13, fontWeight: '700' },
  saveBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.wyldPurple,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
