import { Redirect, router } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { useAuth, Role } from '@/lib/auth';
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  gym_owner: 'Gym Owner',
  gym_employee: 'Gym Employee',
  member: 'Member',
};

export default function Dashboard() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={styles.greeting}>
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.
      </Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>
          {profile ? ROLE_LABEL[profile.role] : 'Loading...'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>You're in.</Text>
        <Text style={styles.cardBody}>
          This is a placeholder dashboard. We'll fill it in as features land.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 48, height: 48 },
  signOut: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  signOutText: { color: theme.colors.charcoal, fontWeight: '600' },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.charcoal,
    marginTop: theme.spacing.xl,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.wyldPurple,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    marginTop: theme.spacing.sm,
  },
  roleBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.charcoal,
    marginBottom: theme.spacing.sm,
  },
  cardBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },
});
