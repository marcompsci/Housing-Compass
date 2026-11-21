import { checkReceivedMessage, localizeWarning } from "@housing-compass/core";
import { useT } from "../i18n";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Icon } from "../components/ui";
import { HIT, color, radius, space, type } from "../theme";

export default function CheckMessage() {
  const { t, locale } = useT();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof checkReceivedMessage> | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.small}>{t("cm.intro")}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
        }}
        multiline
        maxLength={5000}
        placeholder={t("cm.placeholder")}
        style={styles.input}
        accessibilityLabel={t("cm.placeholder")}
      />
      <Button label={t("cm.check")} icon="shield-checkmark-outline" disabled={text.trim().length < 10} onPress={() => setResult(checkReceivedMessage(text))} testID="check-message" />
      {result ? (
        <View style={{ gap: space.md }} accessibilityLiveRegion="polite">
          {result.level === "stop" ? (
            <Banner tone="danger" icon="hand-left-outline" title={t("cm.stopTitle")}>
              {t("cm.stopBody")}
            </Banner>
          ) : result.level === "be_careful" ? (
            <Banner tone="warn" icon="warning-outline" title={t("cm.careful")} />
          ) : (
            <Banner tone="info" icon="checkmark-circle-outline" title={t("cm.okTitle")}>
              {t("cm.okBody")}
            </Banner>
          )}
          {locale !== "en" ? <Text style={type.tiny}>{t("cm.englishOnly")}</Text> : null}
          {result.warnings.map((raw) => localizeWarning(raw, locale)).map((w) => (
            <View key={w.code} style={styles.warning}>
              <Icon name={w.severity === "high" ? "alert-circle" : "alert-circle-outline"} size={20} tint={w.severity === "high" ? color.danger : color.warn} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.body, { fontWeight: "700" }]}>{w.why}</Text>
                <Text style={type.small}>{w.doThis}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  input: { minHeight: HIT * 3, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, padding: 12, fontSize: 15, color: color.ink, backgroundColor: color.surface, textAlignVertical: "top" },
  warning: { flexDirection: "row", gap: 10, padding: space.md, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line },
});
