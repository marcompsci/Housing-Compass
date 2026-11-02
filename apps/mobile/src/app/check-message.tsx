import { checkReceivedMessage } from "@housing-compass/core";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button, Icon } from "../components/ui";
import { HIT, color, radius, space, type } from "../theme";

export default function CheckMessage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof checkReceivedMessage> | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={type.small}>Paste a message you got from a landlord or agent. It's checked on this phone and never uploaded.</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
        }}
        multiline
        maxLength={5000}
        placeholder="Paste the message here"
        style={styles.input}
        accessibilityLabel="Message to check"
      />
      <Button label="Check this message" icon="shield-checkmark-outline" disabled={text.trim().length < 10} onPress={() => setResult(checkReceivedMessage(text))} testID="check-message" />
      {result ? (
        <View style={{ gap: space.md }} accessibilityLiveRegion="polite">
          {result.level === "stop" ? (
            <Banner tone="danger" icon="hand-left-outline" title="Stop — don't send money or personal details">
              This message has warning signs common in rental scams. The listing may still be real, but verify before you do anything.
            </Banner>
          ) : result.level === "be_careful" ? (
            <Banner tone="warn" icon="warning-outline" title="Be careful" />
          ) : (
            <Banner tone="info" icon="checkmark-circle-outline" title="No common warning signs found">
              That isn't a guarantee. Still tour first and confirm the manager through their official website.
            </Banner>
          )}
          {result.warnings.map((w) => (
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
