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

export default function BrandedJoin() {
  const site = useGymSite();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleJoin() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpErr) {
      setSubmitting(false);
      setError(signUpErr.message);
      return;
    }
    // If the project allows immediate sign-in (no email confirmation), create the
    // membership now. Otherwise, the membership row will be created after they
    // confirm and sign in for the first time.
    const userId = signUpData.user?.id ?? null;
    if (userId) {
      await supabase
        .from('gym_memberships')
        .insert({ member_id: userId, gym_id: site.gym.id, status: 'active' });
    }
    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <View style={[styles.page, isWide && styles.pageWide]}>
        <View style={[styles.card, { borderColor: site.theme.accent_color }]}>
          <Text style={[styles.h1, { color: site.theme.primary_color }]}>Check your email</Text>
          <Text style={styles.sub}>
            We sent a confirmation link to {email}. Click it to finish creating your account
            and your membership at {site.gym.name}.
          </Text>
          <Pressable
            style={[styles.cta, { backgroundColor: site.theme.accent_color }]}
            onPress={() => router.push(`/g/${slug}/login` as never)}
          >
            <Text style={styles.ctaText}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <View style={[styles.card, { borderColor: site.theme.accent_color }]}>
        <Text style={[styles.h1, { color: site.theme.primary_color }]}>
          Join {site.gym.name}
        </Text>
        <Text style={styles.sub}>
          Create your member account at {site.gym.name}.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Jane Doe"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>
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
            placeholder="At least 8 characters"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleJoin}
          disabled={submitting}
          style={[
            styles.cta,
            { backgroundColor: site.theme.accent_color },
            submitting && { opacity: 0.6 },
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Create account</Text>}
        </Pressable>

        <Pressable
          onPress={() => router.push(`/g/${slug}/login` as never)}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>
            Already have an account?{' '}
            <Text style={[styles.link, { color: site.theme.accent_color }]}>Sign in</Text>
          </Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Creating an account will take you to our partner's secure member dashboard.
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
