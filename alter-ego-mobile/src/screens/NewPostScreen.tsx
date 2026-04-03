import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { feedbackService } from '@/services/feedback';
import { TagSelector } from '@/components/feedback/TagSelector';
import type { FeedbackTag } from '@/services/feedback';
import type { MainStackParamList } from '@/navigation/types';

const MAX_CHARS = 280;

type NewPostNavigation = StackNavigationProp<MainStackParamList, 'NewPost'>;

export function NewPostScreen() {
  const navigation = useNavigation<NewPostNavigation>();
  const [tag, setTag] = useState<FeedbackTag>('bug');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const canSubmit = content.trim().length >= 10 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await feedbackService.createPost(tag, content.trim());
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        navigation.goBack();
      }, 2000);
    } catch {
      Alert.alert('Something went wrong', "Your post couldn't be submitted. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Post submitted</Text>
          <Text style={styles.successSub}>
            You&apos;ll see it on the board as &quot;Pending review&quot; until it&apos;s approved.{`\n`}
            After approval, everyone can see it and upvote.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backChev}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Post</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Share a bug, suggestion, or thought. The most upvoted posts get reviewed first.
          </Text>

          <View style={styles.sectionLblRow}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionLbl}>CHOOSE A TAG</Text>
          </View>
          <TagSelector selected={tag} onSelect={setTag} />

          <View style={styles.sectionLblRow}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionLbl}>YOUR COMMENT</Text>
          </View>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="Describe the issue, idea, or question..."
              placeholderTextColor="#4B5563"
              value={content}
              onChangeText={(t) => setContent(t.slice(0, MAX_CHARS))}
              multiline
              maxLength={MAX_CHARS}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {content.length} / {MAX_CHARS}
            </Text>
          </View>

          <View style={styles.anonBox}>
            <Text style={styles.anonIcon}>ℹ</Text>
            <Text style={styles.anonText}>
              Posts are <Text style={styles.anonBold}>anonymous</Text>. Your username is never shown. New posts
              show as pending until the team approves them for everyone.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            activeOpacity={0.8}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>Submit Post</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0D0E1A' },
  kav: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backChev: { fontSize: 22, color: '#9CA3AF', lineHeight: 26 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#E5E7EB' },
  headerSpacer: { width: 36 },
  scroll: { padding: 16, paddingBottom: 48 },
  intro: { fontSize: 13, color: '#6B7280', lineHeight: 21, marginBottom: 20 },
  sectionLblRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: '#6D28D9' },
  sectionLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B7280' },
  inputBox: {
    backgroundColor: '#13152A',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  input: { fontSize: 13, color: '#E5E7EB', lineHeight: 20, minHeight: 100 },
  charCount: { fontSize: 10, color: '#6B7280', textAlign: 'right', marginTop: 8 },
  anonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    borderRadius: 12,
    marginBottom: 20,
  },
  anonIcon: { fontSize: 14, color: '#6B7280', marginTop: 1 },
  anonText: { flex: 1, fontSize: 11, color: '#6B7280', lineHeight: 17 },
  anonBold: { color: '#9CA3AF', fontWeight: '600' },
  submitBtn: {
    height: 52,
    backgroundColor: '#6D28D9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  submitBtnDisabled: { backgroundColor: '#1E2333', shadowOpacity: 0 },
  submitText: { fontSize: 15, fontWeight: '700', color: 'white' },
  submitTextDisabled: { color: '#4B5563' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successCheck: { fontSize: 28, color: '#10B981' },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#E5E7EB', marginBottom: 8 },
  successSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
