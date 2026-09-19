import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AuthSessionUser } from '../features/auth/useAuthSession';

type SettingsScreenProps = {
  user: AuthSessionUser;
  error: string | null;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
};

export const SettingsScreen = ({
  user,
  error,
  isSigningOut,
  onSignOut,
}: SettingsScreenProps) => (
  <SafeAreaView accessibilityLabel="設定画面" style={styles.screen}>
    <Text style={styles.eyebrow}>ACCOUNT</Text>
    <Text accessibilityRole="header" style={styles.title}>
      設定
    </Text>
    <Text style={styles.description}>
      ログイン中のアカウントとセッションを管理します。
    </Text>

    <View style={styles.card}>
      <Text style={styles.cardLabel}>ログイン中のアカウント</Text>
      <View style={styles.accountBadge}>
        <View accessibilityElementsHidden style={styles.accountDot} />
        <Text style={styles.accountText}>
          {user.email ? `${user.email} でログイン中` : 'アカウントにログイン中'}
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
          isSigningOut && styles.signOutButtonDisabled,
        ]}
      >
        <Text style={styles.signOutButtonText}>
          {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
        </Text>
      </Pressable>

      {error ? (
        <View accessibilityRole="alert" style={styles.errorFeedback}>
          <Text style={styles.errorFeedbackText}>{error}</Text>
        </View>
      ) : null}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
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
    marginTop: 34,
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  cardLabel: {
    color: '#102B3D',
    fontSize: 16,
    fontWeight: '800',
  },
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
  accountText: {
    color: '#334F5E',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
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
  signOutButtonDisabled: {
    opacity: 0.65,
  },
  signOutButtonText: {
    color: '#294656',
    fontSize: 14,
    fontWeight: '800',
  },
  errorFeedback: {
    backgroundColor: '#FCE8E6',
    borderRadius: 10,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  errorFeedbackText: {
    color: '#8F2720',
    fontSize: 12,
    lineHeight: 18,
  },
});
