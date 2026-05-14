import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function pickAndUploadImages(
  gymId: string,
  options: { multiple?: boolean } = {},
): Promise<string[]> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return [];
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (options.multiple) input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      const urls: string[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${gymId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safeName}`;
        const { error } = await supabase.storage
          .from('gym-assets')
          .upload(path, file, { upsert: false });
        if (error) {
          console.error('upload error', error);
          continue;
        }
        const { data } = supabase.storage.from('gym-assets').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      resolve(urls);
    };
    input.click();
  });
}
