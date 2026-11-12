import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Write a CSV file into the app's private cache directory and return its URI. */
export async function writeCsvToCache(csv: string, fileName: string): Promise<string> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(csv);
  return file.uri;
}

export async function shareCsv(uri: string, dialogTitle: string): Promise<'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle, UTI: 'public.comma-separated-values-text' });
  return 'shared';
}
