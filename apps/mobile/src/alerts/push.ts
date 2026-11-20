import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../data/supabase";
import { log } from "../lib/log";

/** Ask for push permission only when the user turns an alert on — never at launch. */
export async function enablePush(userId: string): Promise<"granted" | "denied" | "unsupported"> {
  if (Platform.OS === "web" || !Device.isDevice || !supabase) return "unsupported";
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return "denied";
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.from("push_tokens").upsert({ token, user_id: userId, platform: Platform.OS, last_seen_at: new Date().toISOString() });
    return "granted";
  } catch (e) {
    log.warn("push token failed", { message: (e as Error).message });
    return "unsupported";
  }
}
