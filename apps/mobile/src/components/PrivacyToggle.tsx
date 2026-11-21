/** Eye button that hides or shows dollar amounts across the money screens (privacy mode). */
import { Pressable } from "react-native";
import { useT } from "../i18n";
import { useRenter } from "../state/renter";
import { HIT, color } from "../theme";
import { Icon } from "./ui";

export function PrivacyToggle() {
  const { t } = useT();
  const hide = useRenter((s) => s.hideAmounts);
  const set = useRenter((s) => s.setHideAmounts);
  return (
    <Pressable onPress={() => set(!hide)} accessibilityRole="switch" accessibilityState={{ checked: hide }} accessibilityLabel={t("priv.label")} hitSlop={10} style={{ minWidth: HIT, minHeight: HIT, alignItems: "center", justifyContent: "center" }} testID="privacy-toggle">
      <Icon name={hide ? "eye-off-outline" : "eye-outline"} size={24} tint={hide ? color.brand : color.muted} />
    </Pressable>
  );
}
