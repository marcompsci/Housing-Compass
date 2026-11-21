/**
 * Hand a generated file (calendar invite, data export) to the user.
 *  - iOS/Android: written to the app's cache folder, then the system share sheet opens
 *    ("Add to Calendar", "Save to Files", Mail…). Nothing is uploaded by us.
 *  - Web: a normal browser download.
 */
import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function saveAndShare(fileName: string, text: string, mime: string, uti?: string): Promise<"shared" | "downloaded" | "text"> {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  if (Platform.OS === "web") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safe;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "downloaded";
  }
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: uti, dialogTitle: safe });
    return "shared";
  }
  await Share.share({ message: text });
  return "text";
}
