import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

/** Opens an external page in the in-app browser (native) or a new tab (web). Never embeds or scrapes it. */
export async function openExternal(url: string): Promise<void> {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
