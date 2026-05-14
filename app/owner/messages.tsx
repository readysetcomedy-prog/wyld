import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';
import { MessagesView } from '@/components/MessagesView';
import { theme } from '@/lib/theme';

export default function OwnerMessages() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.body}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.sub}>
        Conversations with your members and visitors. Anonymous contact-form messages live
        here too — reply by email.
      </Text>
      <MessagesView mode="owner" gymId={gymId} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12, minHeight: 600 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
  body: { fontSize: 15, color: theme.colors.textSecondary },
});
