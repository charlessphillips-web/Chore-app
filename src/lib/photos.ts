import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Photos are stored inside Firestore as compressed JPEG data, so no paid
 * Firebase Storage plan is needed. Each chore gets:
 *  - a small thumbnail (shown in the activity feed), and
 *  - a larger photo (loaded only when someone taps to check it).
 * Firestore documents max out at 1 MB, so the large photo is kept well under that.
 */
export interface ChorePhoto {
  /** data:image/jpeg;base64,... for display */
  previewUri: string;
  thumb: string;
  full: string;
}

const MAX_FULL_BYTES = 700_000;

async function toJpegBase64(uri: string, width: number, compress: number): Promise<string> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!out.base64) throw new Error('Could not process photo.');
  return out.base64;
}

/**
 * Opens the camera (gallery is not allowed on phones, so people can't reuse
 * old photos). Returns null if they cancel.
 */
export async function takeChorePhoto(): Promise<ChorePhoto | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Camera access is needed to prove the chore is done. You can turn it on in Settings.');
    }
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  const uri = result.assets[0].uri;

  let full = '';
  for (const [w, q] of [[1080, 0.6], [800, 0.5], [600, 0.4]] as const) {
    full = await toJpegBase64(uri, w, q);
    if (full.length <= MAX_FULL_BYTES) break;
  }
  if (full.length > MAX_FULL_BYTES) throw new Error('That photo is too large — try again.');
  const thumb = await toJpegBase64(uri, 240, 0.5);
  return { previewUri: `data:image/jpeg;base64,${thumb}`, thumb, full };
}

export const jpegUri = (base64: string) => `data:image/jpeg;base64,${base64}`;

/**
 * Pick a picture from the phone's photos (house wallpaper, bug report
 * screenshot). Returns compressed base64 JPEG, or null if cancelled.
 */
export async function pickFromLibrary(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;
  const uri = result.assets[0].uri;
  for (const [w, q] of [[900, 0.5], [700, 0.45], [500, 0.4]] as const) {
    const data = await toJpegBase64(uri, w, q);
    if (data.length <= MAX_FULL_BYTES) return data;
  }
  throw new Error('That photo is too large — try another.');
}
