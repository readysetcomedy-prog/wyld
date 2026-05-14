import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Settings = {
  social_instagram: string | null;
  social_facebook: string | null;
  social_x: string | null;
  social_tiktok: string | null;
};

function normalizeHandle(value: string, baseUrl: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.includes('.') && !v.startsWith('@')) return `https://${v.replace(/^\/+/, '')}`;
  return `${baseUrl}${encodeURIComponent(v.replace(/^@/, ''))}`;
}

export function SocialIcons({
  settings,
  accent,
}: {
  settings: Settings;
  accent?: string;
}) {
  const items = [
    settings.social_instagram
      ? {
          key: 'instagram',
          label: 'Instagram',
          glyph: 'IG',
          color: '#E1306C',
          url: normalizeHandle(settings.social_instagram, 'https://instagram.com/'),
        }
      : null,
    settings.social_facebook
      ? {
          key: 'facebook',
          label: 'Facebook',
          glyph: 'f',
          color: '#1877F2',
          url: normalizeHandle(settings.social_facebook, 'https://facebook.com/'),
        }
      : null,
    settings.social_x
      ? {
          key: 'x',
          label: 'X',
          glyph: '𝕏',
          color: '#000000',
          url: normalizeHandle(settings.social_x, 'https://x.com/'),
        }
      : null,
    settings.social_tiktok
      ? {
          key: 'tiktok',
          label: 'TikTok',
          glyph: '♪',
          color: '#000000',
          url: normalizeHandle(settings.social_tiktok, 'https://www.tiktok.com/@'),
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    glyph: string;
    color: string;
    url: string;
  }[];

  if (items.length === 0) return null;

  return (
    <View style={styles.row}>
      {items.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => Linking.openURL(s.url)}
          accessibilityLabel={s.label}
          style={[
            styles.chip,
            { backgroundColor: s.color, borderColor: accent ?? 'rgba(255,255,255,0.4)' },
          ]}
        >
          <Text style={styles.glyph}>{s.glyph}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  glyph: { color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 22 },
});
