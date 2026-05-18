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
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { QuoteButton } from '@/components/QuoteButton';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type Item = { label: string; href: string };

const MENU_ITEMS: Item[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Sign in', href: '/sign-in' },
];

// When onQuotePress is given (the landing page), the CTA scrolls to the
// inline quote section instead of opening the modal.
export function Nav({
  logoUrl = WYLD_INC_LOGO_URL,
  onQuotePress,
}: {
  logoUrl?: string;
  onQuotePress?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const go = (href: string) => {
    setOpen(false);
    router.push(href as never);
  };

  const quoteCta = onQuotePress ? (
    <AnimatedPressable onPress={onQuotePress} style={styles.quoteBtn}>
      <Text style={styles.quoteBtnText}>Get a Quote</Text>
    </AnimatedPressable>
  ) : (
    <QuoteButton label="Get a Quote" variant="solid" />
  );

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

      {isWide ? (
        <View style={styles.rightWide}>
          {MENU_ITEMS.map((item) => (
            <Link key={item.label} href={item.href as never} asChild>
              <Pressable>
                {(state) => (
                  <Text
                    style={[
                      styles.linkText,
                      (state as { hovered?: boolean }).hovered && styles.linkTextHover,
                    ]}
                  >
                    {item.label}
                  </Text>
                )}
              </Pressable>
            </Link>
          ))}
          {quoteCta}
        </View>
      ) : (
        <View style={styles.right}>
          {quoteCta}
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
      )}

      <Modal
        visible={open}
        onRequestClose={() => setOpen(false)}
        transparent
        animationType="fade"
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.panel}>
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
            <Pressable key={item.label} style={styles.item} onPress={() => go(item.href)}>
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}
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
  logo: { width: 132, height: 56 },
  logoMobile: { width: 96, height: 44 },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rightWide: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  linkText: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  linkTextHover: { color: theme.colors.wyldPurple },
  quoteBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  quoteBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
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
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  panelLogo: { width: 110, height: 48 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 28, color: theme.colors.charcoal, lineHeight: 28 },
  item: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  itemText: { fontSize: 16, fontWeight: '700', color: theme.colors.charcoal },
});
