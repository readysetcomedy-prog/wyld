import { View, Text, StyleSheet } from 'react-native';
import { MessagesView } from '@/components/MessagesView';
import { theme } from '@/lib/theme';

export default function AdminMessages() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.sub}>Direct messages from members and gym owners.</Text>
      <MessagesView mode="admin" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12, minHeight: 600 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary },
});
