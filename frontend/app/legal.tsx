import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "@/src/theme";

type LegalType = "about" | "guidelines" | "terms" | "privacy" | "safety" | "help" | "contact";

const LEGAL_CONTENT: Record<LegalType, { title: string; subtitle: string; content: string }> = {
  about: {
    title: "About Private Voices",
    subtitle: "Safe, anonymous social platform for honest expression.",
    content: `Private Voices is a next-generation social network designed for authentic communication, peer support, and honest conversations.

Our Core Values:
• Identity Protection: We prioritize your privacy and pseudonymous expression.
• Safe Spaces: Join communities tailored to your interests without fear of judgment.
• Supportive Interactions: Express yourself freely through posts, whispers, and group spaces while maintaining complete control over your public presence.

Version 1.0.0 — Built with care for safe digital expression.`,
  },
  guidelines: {
    title: "Community Guidelines",
    subtitle: "Keeping Private Voices safe, empathetic, and respectful.",
    content: `1. Be Kind and Empathetic
Treat every community member with dignity and respect. Diversity of thought is welcomed; cruelty is not.

2. Zero Tolerance for Harassment & Hate Speech
Bullying, targeted abuse, hate speech, racism, sexism, and discrimination are strictly prohibited.

3. Respect Anonymity & Privacy
Never attempt to unmask, doxx, or leak real-world personal information of any user.

4. Protect Vulnerable Members
Do not post content encouraging self-harm, dangerous activities, or violence. If you or someone you know is in crisis, please seek immediate help from a healthcare provider or crisis hotline.

5. Spam & Scam Prevention
Do not use Private Voices to spam, run deceptive schemes, or distribute malicious content.`,
  },
  terms: {
    title: "Terms of Service",
    subtitle: "Terms and conditions governing your use of Private Voices.",
    content: `Effective Date: September 2026

1. Acceptance of Terms
By creating an account or accessing Private Voices, you agree to comply with these Terms of Service and all applicable laws.

2. User Content & Pseudonymity
You retain ownership of the content you publish. You are responsible for ensuring that your contributions abide by our Community Guidelines.

3. Account Security
You are responsible for maintaining the confidentiality of your login credentials and for all activities occurring under your account.

4. Service Availability & Modifications
We reserve the right to update, modify, or suspend features to enhance platform safety, stability, and user experience.

5. Termination
Violations of platform policies may result in warning, content removal, or permanent account suspension.`,
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "How we collect, use, and safeguard your data.",
    content: `1. Information We Collect
We collect minimal information necessary to deliver our services, such as your pseudonymous account details, chosen handle, and platform interactions.

2. How We Use Information
• To operate, maintain, and improve platform functionality.
• To secure accounts and prevent fraud or abusive behavior.
• To deliver real-time notifications and anonymous messaging (whispers).

3. Data Sharing & Disclosure
We do not sell your personal data. Anonymous whispers and pseudonymous interactions are strictly segregated to ensure message privacy.

4. Data Retention & Control
You can update your profile information or request account deletion at any time through application settings.`,
  },
  safety: {
    title: "Safety Center",
    subtitle: "Tools and practices ensuring a protected environment.",
    content: `Safety Features on Private Voices:

• Pseudonymous Identity: Choose how you present yourself publicly without exposing sensitive personal identifiers.
• Blocking & Moderation: Easily block disruptive users and report inappropriate content directly from post and profile screens.
• Secret Anonymous Whispers: Send secret messages without revealing your identity to the recipient.
• Rapid Review: Our moderation team reviews reported posts and accounts promptly to uphold community standards.`,
  },
  help: {
    title: "Help Center",
    subtitle: "Frequently asked questions and guides.",
    content: `Frequently Asked Questions:

Q: Are posts on my profile completely anonymous?
A: Public posts display your pseudonymous handle and avatar. Secret whispers sent directly to users remain completely anonymous.

Q: How do I change my handle?
A: Navigate to Settings > Account > Change Username.

Q: How do I report abusive posts?
A: Tap the three dots (...) menu on any post or comment to file a report immediately.

Q: How do I create a community?
A: Go to the Communities tab and tap "Create Community" to start your own dedicated space.`,
  },
  contact: {
    title: "Contact Us",
    subtitle: "Get in touch with the Private Voices team.",
    content: `We're here to help! Reach out to us for assistance, inquiries, or feedback:

• General Support: support@privatevoices.app
• Safety & Moderation: safety@privatevoices.app
• Legal & Inquiries: legal@privatevoices.app

Official Website: https://privatevoices.vercel.app

Our support team typically responds within 24–48 hours.`,
  },
};

export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const typeKey = (params.type || "about") as LegalType;

  const data = LEGAL_CONTENT[typeKey] || LEGAL_CONTENT.about;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0F172A", "#0B1220"]} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {data.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.titleBadge}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.brand} />
            <Text style={styles.badgeText}>Official Document</Text>
          </View>
          
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>{data.subtitle}</Text>
          <View style={styles.divider} />
          <Text style={styles.body}>{data.content}</Text>
        </View>

        <Text style={styles.footer}>Private Voices · Privacy & Safety First</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  headerTitle: { ...font.h2, fontSize: 18, color: colors.onSurface },
  scrollContent: { padding: spacing.lg, paddingBottom: 60 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  badgeText: { ...font.caption, color: colors.brand, marginLeft: 6, fontWeight: "700" },
  title: { ...font.h1, fontSize: 22, color: colors.onSurface, marginBottom: 4 },
  subtitle: { ...font.body, color: colors.onSurfaceMuted, fontSize: 14, marginBottom: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginBottom: spacing.lg },
  body: { ...font.body, color: colors.onSurface, fontSize: 15, lineHeight: 24 },
  footer: { textAlign: "center", color: colors.onSurfaceDim, fontSize: 12, marginTop: spacing.xl },
});
