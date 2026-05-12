import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, Redirect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme, LOGO_URL } from '@/lib/theme';

export default function SignIn() {
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (session) return <Redirect href="/dashboard" />;

  async function handle() {
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
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/" asChild>
        <Pressable>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        </Pressable>
      </Link>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to your WyLD Pass account.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#94a3b8"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handle}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        New here?{' '}
        <Link href="/sign-up" style={styles.link}>
          Create an account
        </Link>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  logo: { width: 72, height: 72, marginTop: theme.spacing.xl },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.charcoal,
    marginTop: theme.spacing.md,
  },
  sub: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  field: { width: '100%', maxWidth: 400, marginBottom: theme.spacing.md },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  error: {
    color: theme.colors.danger,
    marginBottom: theme.spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  button: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.teal,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { marginTop: theme.spacing.lg, color: theme.colors.textSecondary, fontSize: 14 },
  link: { color: theme.colors.teal, fontWeight: '600' },
});
