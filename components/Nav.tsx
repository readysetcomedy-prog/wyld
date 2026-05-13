import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { theme, LOGO_URL } from '@/lib/theme';

type Item = { label: string; href: string };

const MENU_ITEMS: Item[] = [
  { label: 'Home', href: '/' },
  { label: 'About WyLD Inc', href: '/about' },
  { label: 'WyLD Pass', href: '/pass' },
  { label: 'WyLD Site', href: '/site' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Sign in', href: '/sign-in' },
];

export function Nav({
  logoUrl = LOGO_URL,
  accent = theme.colors.teal,
}: {
  logoUrl?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const go = (href: string) => {
    setOpen(false);
    router.push(href as never);
  };

  return (
    <View style={[styles.nav, isWide && styles.navWide]}>
      <Link href="/" asChild>
        <Pressable style={styles.brand} accessibilityLabel="Home">
          <Image
            source={{ uri: logoUrl }}
            style={isWide ? styles.logo : styles.logoMobile}
            resizeMode="contain"
          />
        </Pressable>
      </Link>
      <View style={styles.right}>
        <Link href="/sign-up" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.cta,
              { backgroundColor: accent, borderColor: accent },
            ])}
          >
            <Text style={styles.ctaText}>Get started</Text>
          </Pressable>
        </Link>
        <Pressable
          style={styles.menuBtn}
          onPress={() => setOpen(true)}
          accessibilityLabel="Open menu"
        >
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        onRequestClose={() => setOpen(false)}
        transparent
        animationType="fade"
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.panel, isWide && styles.panelWide]}>
          <View style={styles.panelHeader}>
            <Image source={{ uri: logoUrl }} style={styles.panelLogo} resizeMode="contain" />
            <Pressable
              style={styles.closeBtn}
              onPress={() => setOpen(false)}
              accessibilityLabel="Close menu"
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>
          </View>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.label}
              style={styles.item}
              onPress={() => go(item.href)}
            >
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.item, { backgroundColor: accent, borderColor: accent }]}
            onPress={() => go('/sign-up')}
          >
            <Text style={[styles.itemText, styles.itemCtaText]}>Get started</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  navWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.lg,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 96, height: 96 },
  logoMobile: { width: 56, height: 56 },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cta: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  menuLine: {
    width: 18,
    height: 2,
    backgroundColor: theme.colors.charcoal,
    borderRadius: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '85%',
    maxWidth: 360,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 16,
  },
  panelWide: { width: 360 },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  panelLogo: { width: 64, height: 64 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 28, color: theme.colors.charcoal, lineHeight: 28 },
  item: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemText: { fontSize: 16, fontWeight: '700', color: theme.colors.charcoal },
  itemCtaText: { color: '#fff' },
});
