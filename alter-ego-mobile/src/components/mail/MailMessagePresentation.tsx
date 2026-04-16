/**
 * Shared inbox row + mail detail typography (TypeChip, body rendering).
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADIUS, SPACING, FONTS } from "@/constants/theme";

export function formatMailType(raw: string): string {
  const t = raw.toLowerCase().replace(/_/g, " ").trim();
  if (!t) return "Message";
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSentAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function TypeChip({ type }: { type: string }) {
  return (
    <View style={presStyles.typeChip}>
      <Text style={presStyles.typeChipText}>{formatMailType(type)}</Text>
    </View>
  );
}

function renderInlineBold(line: string): React.ReactNode {
  const parts = line.split(/\*\*/);
  if (parts.length === 1) return line;
  return parts.map((segment, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={presStyles.bodyBold}>
        {segment}
      </Text>
    ) : (
      <Text key={i}>{segment}</Text>
    )
  );
}

/** Split markdown-ish body into paragraphs; inline **bold**. */
export function MailBodyText({ body }: { body: string }) {
  const paragraphs = body.replace(/\r/g, "").split(/\n\n+/);
  return (
    <View style={{ gap: SPACING.md }}>
      {paragraphs.map((para, pi) => {
        if (!para.trim()) return null;
        const lines = para.split("\n");
        return (
          <View key={pi} style={{ gap: SPACING.xs }}>
            {lines.map((line, li) => (
              <Text key={li} style={presStyles.bodyLine}>
                {renderInlineBold(line)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const presStyles = StyleSheet.create({
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(109,40,217,0.25)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  typeChipText: {
    fontSize: FONTS.micro.size,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    color: COLORS.violetGlow,
    textTransform: "uppercase",
  },
  bodyLine: {
    fontSize: FONTS.bodyMd.size,
    color: COLORS.text2,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  bodyBold: {
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
  },
});
