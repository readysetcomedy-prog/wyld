import { useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '@/lib/theme';

// Cross-platform signature pad — PanResponder for input, react-native-svg
// for rendering. The signature is reported as a JSON string of strokes
// (arrays of {x,y} points) so it can be re-rendered later on any platform.

type Pt = { x: number; y: number };

const PAD_HEIGHT = 160;

function pathOf(pts: Pt[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const p = pts[0];
    return `M${p.x} ${p.y} L${p.x + 0.1} ${p.y}`;
  }
  return (
    `M${pts[0].x} ${pts[0].y} ` +
    pts.slice(1).map((p) => `L${p.x} ${p.y}`).join(' ')
  );
}

export function SignaturePad({
  onChange,
}: {
  onChange: (data: string | null) => void;
}) {
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const current = useRef<Pt[]>([]);
  const [, tick] = useState(0);
  const rerender = () => tick((n) => n + 1);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        current.current = [{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }];
        rerender();
      },
      onPanResponderMove: (e) => {
        current.current.push({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
        rerender();
      },
      onPanResponderRelease: () => {
        if (current.current.length > 0) {
          setStrokes((prev) => {
            const next = [...prev, current.current];
            onChange(JSON.stringify(next));
            return next;
          });
        }
        current.current = [];
      },
    })
  ).current;

  function clear() {
    setStrokes([]);
    current.current = [];
    onChange(null);
    rerender();
  }

  return (
    <View>
      <View style={styles.pad} {...pan.panHandlers}>
        <Svg width="100%" height={PAD_HEIGHT}>
          {strokes.map((s, i) => (
            <Path
              key={i}
              d={pathOf(s)}
              stroke="#0F172A"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {current.current.length > 0 ? (
            <Path
              d={pathOf(current.current)}
              stroke="#0F172A"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
        {strokes.length === 0 && current.current.length === 0 ? (
          <Text style={styles.hint}>Sign here</Text>
        ) : null}
      </View>
      <Pressable style={styles.clearBtn} onPress={clear}>
        <Text style={styles.clearText}>Clear signature</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    height: PAD_HEIGHT,
    maxWidth: 520,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: PAD_HEIGHT / 2 - 10,
    color: '#cbd5e1',
    fontSize: 14,
    fontStyle: 'italic',
  },
  clearBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
});
