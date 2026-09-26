import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AuthSessionUser } from '../features/auth/useAuthSession';
import type { ProfileFailure } from '../features/profile/profileService';

type SaveDisplayNameResult =
  { ok: true } | { ok: false; error: ProfileFailure };

type SettingsScreenProps = {
  user: AuthSessionUser;
  displayName: string;
  error: string | null;
  isSigningOut: boolean;
  onSaveDisplayName: (displayName: string) => Promise<SaveDisplayNameResult>;
  onSignOut: () => Promise<void>;
};

const validationMessage =
  '表示名は前後に空白を入れず、1〜15文字で入力してください。';

export const SettingsScreen = ({
  user,
  displayName,
  error,
  isSigningOut,
  onSaveDisplayName,
  onSignOut,
}: SettingsScreenProps) => {
  const [name, setName] = useState(displayName);
  const [profileFeedback, setProfileFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  }>();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const saveName = async () => {
    if (savingRef.current) return;

    if (name.length < 1 || name.length > 15 || name !== name.trim()) {
      setProfileFeedback({ kind: 'error', message: validationMessage });
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setProfileFeedback(undefined);
    try {
      const result = await onSaveDisplayName(name);
      setProfileFeedback(
        result.ok
          ? { kind: 'success', message: '表示名を更新しました。' }
          : { kind: 'error', message: result.error.message },
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView accessibilityLabel="設定画面" style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text accessibilityRole="header" style={styles.title}>
          設定
        </Text>
        <Text style={styles.description}>
          表示名とログイン中のセッションを管理します。
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>表示名</Text>
          <Text style={styles.cardDescription}>
            グループのメンバーに表示される名前です。
          </Text>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>現在の表示名</Text>
            <Text style={styles.hint}>15文字以内</Text>
          </View>
          <TextInput
            accessibilityLabel="表示名"
            autoCapitalize="none"
            editable={!isSaving}
            maxLength={15}
            onChangeText={setName}
            selectionColor="#D69332"
            style={styles.input}
            value={name}
          />
          <Pressable
            accessibilityLabel={isSaving ? '表示名を保存中' : '表示名を保存'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            disabled={isSaving}
            onPress={() => void saveName()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              isSaving && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? '保存中…' : '表示名を保存'}
            </Text>
          </Pressable>
          {profileFeedback ? (
            <View
              accessibilityRole="alert"
              style={
                profileFeedback.kind === 'success'
                  ? styles.successFeedback
                  : styles.errorFeedback
              }
            >
              <Text
                style={
                  profileFeedback.kind === 'success'
                    ? styles.successText
                    : styles.errorText
                }
              >
                {profileFeedback.message}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ログイン中のアカウント</Text>
          <View style={styles.accountBadge}>
            <View accessibilityElementsHidden style={styles.accountDot} />
            <Text style={styles.accountText}>
              {user.email
                ? `${user.email} でログイン中`
                : 'アカウントにログイン中'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={isSigningOut ? 'ログアウト中' : 'ログアウト'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSigningOut }}
            disabled={isSigningOut}
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
              isSigningOut && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.signOutButtonText}>
              {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
            </Text>
          </Pressable>
          {error ? (
            <View accessibilityRole="alert" style={styles.errorFeedback}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B2638', flex: 1 },
  content: { paddingBottom: 36, paddingHorizontal: 20, paddingTop: 28 },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    marginTop: 24,
    padding: 22,
  },
  cardLabel: { color: '#102B3D', fontSize: 16, fontWeight: '800' },
  cardDescription: {
    color: '#617783',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  inputLabel: { color: '#294656', fontSize: 12, fontWeight: '700' },
  hint: { color: '#7C8D97', fontSize: 12 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D4DA',
    borderRadius: 12,
    borderWidth: 1,
    color: '#153447',
    fontSize: 15,
    marginTop: 8,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#D68B21',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    marginTop: 14,
  },
  saveButtonPressed: {
    backgroundColor: '#BE7518',
    transform: [{ scale: 0.99 }],
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  accountBadge: {
    alignItems: 'center',
    backgroundColor: '#E8EFF2',
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  accountDot: {
    backgroundColor: '#3B7A57',
    borderRadius: 4,
    height: 8,
    marginRight: 10,
    width: 8,
  },
  accountText: { color: '#334F5E', flex: 1, fontSize: 12, lineHeight: 18 },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#B7C6CD',
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginTop: 24,
  },
  signOutButtonPressed: {
    backgroundColor: '#E8EFF2',
    transform: [{ scale: 0.99 }],
  },
  signOutButtonText: { color: '#294656', fontSize: 14, fontWeight: '800' },
  successFeedback: {
    backgroundColor: '#E3F3E8',
    borderRadius: 10,
    marginTop: 12,
    padding: 11,
  },
  successText: { color: '#25613E', fontSize: 12, lineHeight: 18 },
  errorFeedback: {
    backgroundColor: '#FCE8E6',
    borderRadius: 10,
    marginTop: 12,
    padding: 11,
  },
  errorText: { color: '#8F2720', fontSize: 12, lineHeight: 18 },
});
