/**
 * Move-in photos. Taken or picked on the phone, then copied into the app's private folder so
 * they survive if the original is deleted from the camera roll. Never uploaded. Location
 * metadata (EXIF) is not requested. Not available on the web build.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { uuid } from "../state/applications";

export const photosSupported = Platform.OS !== "web";
const folder = () => new Directory(Paths.document, "move-in-photos");

export async function addConditionPhoto(source: "camera" | "library"): Promise<{ uri: string; at: string } | "denied" | null> {
  if (!photosSupported) return null;
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return "denied";
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, exif: false, allowsEditing: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${uuid()}.jpg`);
  new File(res.assets[0].uri).copy(dest);
  return { uri: dest.uri, at: new Date().toISOString() };
}

export function deletePhotoFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
}

export function deleteAllPhotos() {
  if (!photosSupported) return;
  try {
    const d = folder();
    if (d.exists) d.delete();
  } catch {
    /* nothing to delete */
  }
}
