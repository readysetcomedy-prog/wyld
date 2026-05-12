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
import { Link, Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme, LOGO_URL } from '@/lib/theme';

export default function SignUp() {
  const { session, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (authLoading) return null;
  if (session) return <Redirect href="/dashboard" />;

  async function handle() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.sub}>
          We sent a confirmation link to {email}. Click it to finish creating your account.
        </Text>
        <Link href="/sign-in" style={styles.doneLink}>
          Back to sign in
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Link href="/" asChild>
        <Pressable>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        </Pressable>
      </Link>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.sub}>
        You'll start as a member. Join or claim a gym after signing up.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Jane Doe"
          placeholderTextColor="#94a3b8"
        />
      </View>
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
          placeholder="At least 8 characters"
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
          <Text style={styles.buttonText}>Create account</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        Already have an account?{' '}
        <Link href="/sign-in" style={styles.link}>
          Sign in
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
    textAlign: 'center',
  },
  sub: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    maxWidth: 400,
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
  doneLink: { color: theme.colors.teal, fontWeight: '600', marginTop: theme.spacing.lg },
});
