import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { supabase } from '@/lib/supabase';

export default function BrandedLogin() {
  const site = useGymSite();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <View style={[styles.card, { borderColor: site.theme.accent_color }]}>
        <Text style={[styles.h1, { color: site.theme.primary_color }]}>Member sign in</Text>
        <Text style={styles.sub}>Sign in to your account at {site.gym.name}.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleSignIn}
          disabled={submitting}
          style={[
            styles.cta,
            { backgroundColor: site.theme.accent_color },
            submitting && { opacity: 0.6 },
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Sign in</Text>}
        </Pressable>

        <Pressable
          onPress={() => router.push(`/g/${slug}/join` as never)}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>
            New here?{' '}
            <Text style={[styles.link, { color: site.theme.accent_color }]}>
              Create an account
            </Text>
          </Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Signing in will take you to our partner's secure member dashboard.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center' },
  pageWide: { paddingVertical: 80 },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#fff',
    gap: 12,
  },
  h1: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 8 },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
  cta: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#DC2626', fontSize: 13 },
  linkRow: { marginTop: 8, alignItems: 'center' },
  linkText: { fontSize: 14, color: '#475569' },
  link: { fontWeight: '700' },
  disclaimer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
