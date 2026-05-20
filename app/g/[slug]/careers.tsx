import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useGymSite } from '@/components/GymSiteContext';

export default function Careers() {
  const site = useGymSite();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const primary = site.theme.primary_color;

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Text style={[styles.eyebrow, { color: site.theme.accent_color }]}>JOIN OUR TEAM</Text>
      <Text style={[styles.title, { color: primary }]}>Careers at {site.gym.name}</Text>
      <Text style={styles.body}>
        Job postings are coming soon. Check back here, or reach out through our contact
        page if you&apos;d like to be the first to know.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 48, gap: 12, alignItems: 'flex-start' },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 80,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 36, fontWeight: '900', lineHeight: 42 },
  body: { fontSize: 16, color: '#475569', lineHeight: 25, maxWidth: 620 },
});
