import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAuthService } from './src/features/auth/auth';
import type { AuthService } from './src/features/auth/authService';
import {
  type AuthStateClient,
  useAuthSession,
} from './src/features/auth/useAuthSession';
import { getSupabaseClient } from './src/lib/supabase';
import { AuthenticatedNavigator } from './src/navigation/AuthenticatedNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { getProfileService } from './src/features/profile/profiles';
import type {
  Profile,
  ProfileService,
} from './src/features/profile/profileService';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';

type AppProps = {
  authClient?: AuthStateClient;
  authService?: Pick<AuthService, 'signOut'>;
  profileService?: Pick<ProfileService, 'getMyProfile' | 'saveDisplayName'>;
};

export const AppContent = ({
  authClient = getSupabaseClient().auth,
  authService,
  profileService,
}: AppProps = {}) => {
  const authSession = useAuthSession(authClient);
  const [profile, setProfile] = useState<Profile | null>();
  const [profileError, setProfileError] = useState<string>();
  const [profileRequest, setProfileRequest] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const resolvedProfileService = useMemo(
    () => profileService ?? getProfileService(),
    [profileService],
  );

  useEffect(() => {
    if (authSession.status !== 'authenticated') {
      setProfile(undefined);
      setProfileError(undefined);
      return;
    }

    let isMounted = true;
    setProfile(undefined);
    setProfileError(undefined);

    void resolvedProfileService.getMyProfile().then((result) => {
      if (!isMounted) return;

      if (result.ok) setProfile(result.profile);
      else setProfileError(result.error.message);
    });

    return () => {
      isMounted = false;
    };
  }, [
    authSession.status,
    authSession.status === 'authenticated' ? authSession.user.id : null,
    profileRequest,
    resolvedProfileService,
  ]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);

    const result = await (authService ?? getAuthService()).signOut();
    setIsSigningOut(false);

    if (!result.ok) {
      setSignOutError(result.error.message);
    }
  };

  if (authSession.status === 'loading') {
    return (
      <>
        <View
          accessibilityLabel="認証状態を確認中"
          accessibilityRole="progressbar"
          style={styles.loadingContainer}
        >
          <ActivityIndicator color="#E7A84B" size="large" />
        </View>
        <StatusBar style="light" />
      </>
    );
  }

  if (authSession.status === 'authenticated') {
    if (profileError) {
      return (
        <View
          accessibilityLabel="プロフィール読み込みエラー"
          style={styles.profileState}
        >
          <Text accessibilityRole="alert" style={styles.profileError}>
            {profileError}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setProfileRequest((current) => current + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>再読み込み</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={isSigningOut ? 'ログアウト中' : 'ログアウト'}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSigningOut }}
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={styles.profileSignOutButton}
          >
            <Text style={styles.profileSignOutButtonText}>
              {isSigningOut ? 'ログアウト中…' : 'ログアウト'}
            </Text>
          </Pressable>
          {signOutError ? (
            <Text accessibilityRole="alert" style={styles.signOutError}>
              {signOutError}
            </Text>
          ) : null}
        </View>
      );
    }

    if (profile === undefined) {
      return (
        <View
          accessibilityLabel="プロフィールを確認中"
          style={styles.loadingContainer}
        >
          <ActivityIndicator color="#E7A84B" size="large" />
        </View>
      );
    }

    if (profile === null) {
      return (
        <ProfileSetupScreen
          onSaved={setProfile}
          profileService={resolvedProfileService}
        />
      );
    }

    return (
      <>
        <AuthenticatedNavigator
          error={signOutError}
          isSigningOut={isSigningOut}
          displayName={profile.displayName}
          onSaveDisplayName={async (displayName) => {
            const result =
              await resolvedProfileService.saveDisplayName(displayName);
            if (result.ok) setProfile(result.profile);
            return result;
          }}
          onSignOut={handleSignOut}
          user={authSession.user}
        />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      <AuthScreen />
      <StatusBar style="light" />
    </>
  );
};

export default function App() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#0B2638',
    flex: 1,
    justifyContent: 'center',
  },
  profileState: {
    alignItems: 'center',
    backgroundColor: '#0B2638',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  profileError: {
    color: '#F5B7B1',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    borderColor: '#E7A84B',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: { color: '#E7A84B', fontSize: 14, fontWeight: '800' },
  profileSignOutButton: { marginTop: 18, padding: 12 },
  profileSignOutButtonText: {
    color: '#AFC2CF',
    fontSize: 14,
    fontWeight: '700',
  },
  signOutError: {
    color: '#F5B7B1',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
