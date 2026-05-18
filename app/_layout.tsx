import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();
  // Set the browser tab title at runtime. Per-gym public sites override this
  // with their own name while mounted and restore it on leave.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'WyLD Inc';
    }
  }, []);
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="portfolio" />
        <Stack.Screen name="about" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="owner" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="member" />
        <Stack.Screen name="g/[slug]" />
      </Stack>
    </AuthProvider>
  );
}
