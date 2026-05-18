import { View, Text, TextStyle } from 'react-native';
import { WaiverBlock, WaiverRun } from '@/lib/waiverTemplate';

const SIZE_MULT: Record<string, number> = { sm: 0.85, md: 1, lg: 1.3, xl: 1.7 };

function blockBase(type: WaiverBlock['type']): number {
  return type === 'h2' ? 22 : type === 'h3' ? 17 : 15;
}

function runStyle(r: WaiverRun, base: number): TextStyle {
  return {
    fontSize: Math.round(base * (r.size ? SIZE_MULT[r.size] : 1)),
    fontWeight: r.bold ? '800' : undefined,
    fontStyle: r.italic ? 'italic' : undefined,
    textDecorationLine: r.underline ? 'underline' : undefined,
    color: r.color || undefined,
  };
}

// Cross-platform waiver renderer — plain React Native <Text>, works on web
// and native (the member signing screen).
export function WaiverBlocksView({ blocks }: { blocks: WaiverBlock[] }) {
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b) => {
        const base = blockBase(b.type);
        const heading = b.type === 'h2' || b.type === 'h3';
        const maxMult = Math.max(
          1,
          ...b.runs.map((r) => (r.size ? SIZE_MULT[r.size] : 1))
        );
        const blockStyle: TextStyle = {
          fontSize: base,
          lineHeight: Math.round(base * maxMult * 1.5),
          fontWeight: heading ? '800' : '400',
          textAlign: b.align ?? 'left',
          color: '#0F172A',
        };
        const runEls = b.runs.map((r, i) => (
          <Text key={i} style={runStyle(r, base)}>
            {r.text}
          </Text>
        ));
        if (b.type === 'bullet') {
          return (
            <View key={b.id} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[blockStyle, { textAlign: 'left' }]}>{'•'}</Text>
              <Text style={[blockStyle, { flex: 1 }]}>{runEls}</Text>
            </View>
          );
        }
        return (
          <Text key={b.id} style={[blockStyle, heading ? { marginTop: 8 } : null]}>
            {runEls}
          </Text>
        );
      })}
    </View>
  );
}
