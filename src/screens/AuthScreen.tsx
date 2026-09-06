import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getAuthService } from '../features/auth/auth';
import type { AuthService } from '../features/auth/authService';

type AuthScreenProps = {
  authService?: AuthService;
};

type FieldErrors = {
  email?: string;
  password?: string;
};

type Feedback = {
  kind: 'success' | 'error';
  text: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen({ authService }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signUp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const submissionInProgress = useRef(false);

  const handleSubmit = async () => {
    if (submissionInProgress.current) {
      return;
    }

    const normalizedEmail = email.trim();
    const errors: FieldErrors = {};

    setFeedback(undefined);

    if (!normalizedEmail) {
      errors.email = 'メールアドレスを入力してください';
    } else if (!emailPattern.test(normalizedEmail)) {
      errors.email = '正しい形式のメールアドレスを入力してください';
    }

    if (!password) {
      errors.password = 'パスワードを入力してください';
    } else if (password.length < 6) {
      errors.password = 'パスワードは6文字以上で入力してください';
    }

    setFieldErrors(errors);

    if (errors.email || errors.password) {
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);

    try {
      const service = authService ?? getAuthService();
      const credentials = { email: normalizedEmail, password };
      const result =
        mode === 'login'
          ? await service.signIn(credentials)
          : await service.signUp(credentials);

      if (result.ok) {
        setFeedback({
          kind: 'success',
          text:
            mode === 'login'
              ? 'ログインしました'
              : '登録を受け付けました。確認メールをご確認ください。',
        });
        return;
      }

      setFeedback({ kind: 'error', text: result.error.message });
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((currentMode) => (currentMode === 'login' ? 'signUp' : 'login'));
    setFieldErrors({});
    setFeedback(undefined);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View accessibilityElementsHidden style={styles.placeMark}>
            <View style={styles.placeRingOuter} />
            <View style={styles.placeRingInner} />
            <View style={styles.placeCore} />
          </View>
          <Text style={styles.brand}>思い出跡地</Text>
          <Text style={styles.tagline}>思い出は、あの場所に残っている。</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            {mode === 'login' ? 'WELCOME BACK' : 'NEW MEMORY KEEPER'}
          </Text>
          <Text style={styles.heading}>
            {mode === 'login' ? '記憶へ戻る' : '記憶を残し始める'}
          </Text>
          <Text style={styles.description}>
            {mode === 'login'
              ? '登録したメールアドレスでログインしてください。'
              : 'メールアドレスとパスワードでアカウントを作成します。'}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              accessibilityLabel="メールアドレス"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="mail@example.com"
              placeholderTextColor="#788995"
              selectionColor="#D69332"
              style={[styles.input, fieldErrors.email && styles.inputError]}
              textContentType="emailAddress"
              value={email}
            />
            {fieldErrors.email ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {fieldErrors.email}
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>パスワード</Text>
              <Text style={styles.hint}>6文字以上</Text>
            </View>
            <TextInput
              accessibilityLabel="パスワード"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              editable={!isSubmitting}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#788995"
              secureTextEntry
              selectionColor="#D69332"
              style={[styles.input, fieldErrors.password && styles.inputError]}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              value={password}
            />
            {fieldErrors.password ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {fieldErrors.password}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityLabel={mode === 'login' ? 'ログイン' : '登録する'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !isSubmitting && styles.primaryButtonPressed,
              isSubmitting && styles.primaryButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator
                accessibilityLabel="認証処理中"
                color="#FFFFFF"
              />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'login' ? 'ログイン' : '登録する'}
              </Text>
            )}
          </Pressable>

          {feedback ? (
            <View
              style={[
                styles.feedback,
                feedback.kind === 'success'
                  ? styles.successFeedback
                  : styles.errorFeedback,
              ]}
            >
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={[
                  styles.feedbackText,
                  feedback.kind === 'success'
                    ? styles.successFeedbackText
                    : styles.errorFeedbackText,
                ]}
              >
                {feedback.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>
              {mode === 'login'
                ? '初めて利用しますか？'
                : 'すでにアカウントをお持ちですか？'}
            </Text>
            <Pressable
              accessibilityLabel={
                mode === 'login' ? 'アカウントを作成' : 'ログインに戻る'
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              hitSlop={8}
              onPress={switchMode}
            >
              <Text style={styles.switchAction}>
                {mode === 'login' ? 'アカウントを作成' : 'ログインに戻る'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D2538',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  placeMark: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    marginBottom: 18,
    width: 72,
  },
  placeRingOuter: {
    borderColor: 'rgba(231, 168, 75, 0.25)',
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    position: 'absolute',
    width: 72,
  },
  placeRingInner: {
    borderColor: 'rgba(231, 168, 75, 0.55)',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    position: 'absolute',
    width: 46,
  },
  placeCore: {
    backgroundColor: '#E7A84B',
    borderColor: '#FFE1A8',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    shadowColor: '#E7A84B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    width: 16,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    color: '#AFC2CF',
    fontSize: 13,
    letterSpacing: 0.8,
    marginTop: 9,
  },
  card: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    shadowColor: '#071723',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
  },
  eyebrow: {
    color: '#B37320',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heading: {
    color: '#102B3D',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  description: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  fieldGroup: {
    marginTop: 20,
  },
  passwordLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#233F50',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: '#71838D',
    fontSize: 11,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CCD8DE',
    borderRadius: 12,
    borderWidth: 1,
    color: '#102B3D',
    fontSize: 16,
    height: 50,
    marginTop: 8,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: '#B42318',
  },
  errorText: {
    color: '#b42318',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#C68429',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonPressed: {
    backgroundColor: '#A96E20',
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  feedback: {
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  successFeedback: {
    backgroundColor: '#E3F2E9',
  },
  errorFeedback: {
    backgroundColor: '#FCE8E6',
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 18,
  },
  successFeedbackText: {
    color: '#24623C',
  },
  errorFeedbackText: {
    color: '#8F2720',
  },
  switchRow: {
    alignItems: 'center',
    borderTopColor: '#DDE5E9',
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 24,
    paddingTop: 20,
  },
  switchPrompt: {
    color: '#657782',
    fontSize: 12,
  },
  switchAction: {
    color: '#9B6117',
    fontSize: 12,
    fontWeight: '800',
  },
});
