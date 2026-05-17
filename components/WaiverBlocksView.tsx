import { View, Text, TextStyle } from 'react-native';
import { WaiverBlock } from '@/lib/waiverTemplate';

export function blockTextStyle(b: WaiverBlock): TextStyle {
  const base = b.type === 'h2' ? 22 : b.type === 'h3' ? 17 : 15;
  const mult = b.size === 'sm' ? 0.85 : b.size === 'lg' ? 1.3 : 1;
  const fontSize = Math.round(base * mult);
  const heading = b.type === 'h2' || b.type === 'h3';
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.5),
    fontWeight: b.bold || heading ? '800' : '400',
    fontStyle: b.italic ? 'italic' : 'normal',
    textDecorationLine: b.underline ? 'underline' : 'none',
    textAlign: b.align ?? 'left',
    color: b.color ?? '#0F172A',
  };
}

export function WaiverBlocksView({ blocks }: { blocks: WaiverBlock[] }) {
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b) => {
        const ts = blockTextStyle(b);
        const headingGap = b.type === 'h2' || b.type === 'h3' ? { marginTop: 8 } : null;
        if (b.type === 'bullet') {
          return (
            <View key={b.id} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[ts, { textAlign: 'left' }]}>{'•'}</Text>
              <Text style={[ts, { flex: 1 }]}>{b.text}</Text>
            </View>
          );
        }
        return (
          <Text key={b.id} style={[ts, headingGap]}>
            {b.text}
          </Text>
        );
      })}
    </View>
  );
}
