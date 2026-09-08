import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AuthSessionUser } from '../features/auth/useAuthSession';

type AuthenticatedScreenProps = {
  user: AuthSessionUser;
  error: string | null;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
};

export const AuthenticatedScreen = ({
  user,
  error,
  isSigningOut,
  onSignOut,
}: AuthenticatedScreenProps) => (
  <ScrollView
    contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled"
    style={styles.screen}
  >
    <View accessibilityElementsHidden style={styles.placeMark}>
      <View style={styles.placeRingOuter} />
      <View style={styles.placeRingInner} />
      <View style={styles.placeCore} />
    </View>

    <Text style={styles.brand}>思い出跡地</Text>
    <Text style={styles.tagline}>思い出は、あの場所に残っている。</Text>

    <View style={styles.card}>
      <Text style={styles.eyebrow}>MEMORY KEEPER</Text>
      <Text style={styles.heading}>思い出を探しに行こう</Text>
      <Text style={styles.description}>
        この先に、みんなで残す思い出の場所が集まります。
      </Text>

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
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  placeMark: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 80,
    justifyContent: 'center',
    marginBottom: 22,
    width: 80,
  },
  placeRingOuter: {
    borderColor: 'rgba(231, 168, 75, 0.25)',
    borderRadius: 40,
    borderWidth: 1,
    height: 80,
    position: 'absolute',
    width: 80,
  },
  placeRingInner: {
    borderColor: 'rgba(231, 168, 75, 0.55)',
    borderRadius: 25,
    borderWidth: 1,
    height: 50,
    position: 'absolute',
    width: 50,
  },
  placeCore: {
    backgroundColor: '#E7A84B',
    borderColor: '#FFE1A8',
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    shadowColor: '#E7A84B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    width: 18,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  tagline: {
    color: '#AFC2CF',
    fontSize: 13,
    letterSpacing: 0.8,
    marginTop: 9,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    marginTop: 42,
    paddingHorizontal: 22,
    paddingVertical: 28,
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
    marginTop: 10,
  },
  accountBadge: {
    alignItems: 'center',
    backgroundColor: '#E8EFF2',
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: 24,
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
