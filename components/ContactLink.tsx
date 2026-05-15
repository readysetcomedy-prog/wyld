import { Pressable, Text, Linking, StyleProp, TextStyle } from 'react-native';

function telHref(phone: string) {
  // Keep digits and leading + only.
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

export function PhoneLink({
  phone,
  style,
  prefix,
}: {
  phone: string;
  style?: StyleProp<TextStyle>;
  prefix?: string;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(telHref(phone))}
      accessibilityRole="link"
      accessibilityLabel={`Call ${phone}`}
    >
      <Text style={style}>
        {prefix}
        {phone}
      </Text>
    </Pressable>
  );
}

export function EmailLink({
  email,
  style,
  prefix,
}: {
  email: string;
  style?: StyleProp<TextStyle>;
  prefix?: string;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(`mailto:${email}`)}
      accessibilityRole="link"
      accessibilityLabel={`Email ${email}`}
    >
      <Text style={style}>
        {prefix}
        {email}
      </Text>
    </Pressable>
  );
}
