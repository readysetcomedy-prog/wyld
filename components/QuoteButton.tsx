import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';

type Variant = 'solid' | 'light' | 'outline';

// "Get a Quote" call-to-action. Opens a modal that files the request into
// the admin message box via the submit_quote_request RPC. Reused in the nav
// and across the landing pages.
export function QuoteButton({
  label = 'Get a Quote',
  variant = 'solid',
  big = false,
}: {
  label?: string;
  variant?: Variant;
  big?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setErr(null);
    }, 250);
  }

  async function submit() {
    setErr(null);
    if (!name.trim() || !email.trim() || !body.trim()) {
      setErr('Please fill in your name, email, and a message.');
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc('submit_quote_request', {
      p_name: name.trim(),
      p_email: email.trim(),
      p_body: body.trim(),
    });
    setSending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
    setName('');
    setEmail('');
    setBody('');
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          big ? styles.btnBig : styles.btn,
          variant === 'solid' && styles.solid,
          variant === 'light' && styles.light,
          variant === 'outline' && styles.outline,
        ]}
      >
        <Text
          style={[
            big ? styles.btnBigText : styles.btnText,
            variant === 'solid' ? styles.textLight : styles.textDark,
          ]}
        >
          {label}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            {sent ? (
              <View style={styles.form}>
                <Text style={styles.title}>Thanks — we&apos;ve got it.</Text>
                <Text style={styles.sub}>
                  Our team will follow up shortly with pricing tailored to your gym.
                </Text>
                <Pressable style={[styles.btn, styles.solid]} onPress={close}>
                  <Text style={[styles.btnText, styles.textLight]}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.title}>Get a quote</Text>
                <Text style={styles.sub}>
                  Tell us about your gym and we&apos;ll put together pricing for you.
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Tell us about your gym — locations, members, what you need…"
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={[styles.input, styles.inputMultiline]}
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.btn, styles.solid, sending && styles.disabled]}
                    onPress={submit}
                    disabled={sending}
                  >
                    <Text style={[styles.btnText, styles.textLight]}>
                      {sending ? 'Sending…' : 'Send request'}
                    </Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.ghost]} onPress={close}>
                    <Text style={[styles.btnText, styles.textDark]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnBig: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnText: { fontSize: 14, fontWeight: '800' },
  btnBigText: { fontSize: 17, fontWeight: '800' },
  textLight: { color: '#fff' },
  textDark: { color: theme.colors.charcoal },
  solid: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  light: { backgroundColor: '#fff', borderColor: '#fff' },
  outline: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  disabled: { opacity: 0.6 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
  },
  form: { gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.charcoal,
    backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  err: { color: theme.colors.danger, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
});
