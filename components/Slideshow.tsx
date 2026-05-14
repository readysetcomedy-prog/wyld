import { useEffect, useState } from 'react';
import { View, Image, Pressable, Text, StyleSheet } from 'react-native';

export function Slideshow({
  urls,
  aspectRatio = 16 / 9,
  rounded = true,
}: {
  urls: string[];
  aspectRatio?: number;
  rounded?: boolean;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (urls.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % urls.length), 5000);
    return () => clearInterval(t);
  }, [urls.length]);

  if (urls.length === 0) return null;

  return (
    <View style={[styles.container, rounded && styles.rounded, { aspectRatio }]}>
      <Image source={{ uri: urls[i] }} style={styles.image} resizeMode="cover" />
      {urls.length > 1 ? (
        <>
          <Pressable
            style={[styles.arrow, styles.left]}
            onPress={() => setI((p) => (p - 1 + urls.length) % urls.length)}
            accessibilityLabel="Previous"
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Pressable
            style={[styles.arrow, styles.right]}
            onPress={() => setI((p) => (p + 1) % urls.length)}
            accessibilityLabel="Next"
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
          <View style={styles.dots}>
            {urls.map((_, idx) => (
              <Pressable key={idx} onPress={() => setI(idx)}>
                <View style={[styles.dot, idx === i && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#0f172a' },
  rounded: { borderRadius: 16 },
  image: { width: '100%', height: '100%' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: { left: 12 },
  right: { right: 12 },
  arrowText: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 30 },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff' },
});
