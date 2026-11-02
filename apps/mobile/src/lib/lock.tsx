/**
 * Optional Face ID / passcode lock for the renter tools (rent, bills, move-in, waitlists).
 * Unlocking lasts until the app goes to the background. Uses the phone's own authentication;
 * we never see a face, fingerprint or passcode. Not available on the web build.
 */
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { Button, Icon } from "../components/ui";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { color, space, type } from "../theme";

export const lockSupported = Platform.OS !== "web";
let unlocked = false;
AppState.addEventListener("change", (s) => {
  if (s === "background") unlocked = false;
});

export async function canUseLock(): Promise<boolean> {
  if (!lockSupported) return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function authenticate(prompt: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false });
  if (r.success) unlocked = true;
  return r.success;
}

export function LockGate({ children }: { children: ReactNode }) {
  const { t } = useT();
  const lockOn = useRenter((s) => s.lockOn);
  const [open, setOpen] = useState(!lockOn || !lockSupported || unlocked);
  useEffect(() => {
    if (!open) void authenticate(t("lock.prompt")).then(setOpen);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (open) return <>{children}</>;
  return (
    <View style={styles.wrap} testID="lock-gate">
      <Icon name="lock-closed-outline" size={40} tint={color.brand} />
      <Text style={type.h2}>{t("lock.title")}</Text>
      <Text style={[type.small, { textAlign: "center" }]}>{t("lock.body")}</Text>
      <Button icon="finger-print-outline" label={t("lock.unlock")} onPress={() => void authenticate(t("lock.prompt")).then(setOpen)} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl } });
