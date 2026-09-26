import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getProfileService } from '../features/profile/profiles';
import type {
  Profile,
  ProfileService,
} from '../features/profile/profileService';

type ProfileSetupScreenProps = {
  onSaved: (profile: Profile) => void;
  profileService?: Pick<ProfileService, 'saveDisplayName'>;
};

const validationMessage =
  '表示名は前後に空白を入れず、1〜15文字で入力してください。';

export const ProfileSetupScreen = ({
  onSaved,
  profileService,
}: ProfileSetupScreenProps) => {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const handleSave = async () => {
    if (savingRef.current) return;

    if (
      displayName.length < 1 ||
      displayName.length > 15 ||
      displayName !== displayName.trim()
    ) {
      setError(validationMessage);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(undefined);

    try {
      const result = await (
        profileService ?? getProfileService()
      ).saveDisplayName(displayName);

      if (result.ok) onSaved(result.profile);
      else setError(result.error.message);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView accessibilityLabel="表示名初期設定画面" style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View accessibilityElementsHidden style={styles.memoryMark}>
          <View style={styles.memoryOuterRing} />
          <View style={styles.memoryInnerRing} />
          <View style={styles.memoryCore} />
        </View>
        <Text style={styles.eyebrow}>YOUR NAME</Text>
        <Text accessibilityRole="header" style={styles.title}>
          思い出に名前を添える
        </Text>
        <Text style={styles.description}>
          グループの仲間に表示する名前です。あとから設定画面で変更できます。
        </Text>

        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>表示名</Text>
            <Text style={styles.hint}>15文字以内</Text>
          </View>
          <TextInput
            accessibilityLabel="表示名"
            autoCapitalize="none"
            editable={!isSaving}
            maxLength={15}
            onChangeText={setDisplayName}
            placeholder="例：山田太郎"
            placeholderTextColor="#788995"
            selectionColor="#D69332"
            style={[styles.input, error && styles.inputError]}
            value={displayName}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
            disabled={isSaving}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !isSaving && styles.saveButtonPressed,
              isSaving && styles.saveButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator
                accessibilityLabel="表示名を保存中"
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.saveButtonText}>表示名を設定する</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B2638', flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  memoryMark: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    marginBottom: 22,
    width: 64,
  },
  memoryOuterRing: {
    borderColor: 'rgba(231, 168, 75, 0.28)',
    borderRadius: 32,
    borderWidth: 1,
    height: 64,
    position: 'absolute',
    width: 64,
  },
  memoryInnerRing: {
    borderColor: 'rgba(231, 168, 75, 0.62)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    position: 'absolute',
    width: 40,
  },
  memoryCore: {
    backgroundColor: '#FFD278',
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 10,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    marginTop: 30,
    padding: 22,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: { color: '#153447', fontSize: 14, fontWeight: '800' },
  hint: { color: '#7C8D97', fontSize: 12 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D4DA',
    borderRadius: 13,
    borderWidth: 1,
    color: '#153447',
    fontSize: 16,
    marginTop: 10,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  inputError: { borderColor: '#A9443C' },
  errorText: {
    color: '#9C342C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#D68B21',
    borderRadius: 13,
    height: 54,
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonPressed: {
    backgroundColor: '#BE7518',
    transform: [{ scale: 0.99 }],
  },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
