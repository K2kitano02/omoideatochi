import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getAuthService } from './src/features/auth/auth';
import type { AuthService } from './src/features/auth/authService';
import {
  type AuthStateClient,
  useAuthSession,
} from './src/features/auth/useAuthSession';
import { getSupabaseClient } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { AuthenticatedScreen } from './src/screens/AuthenticatedScreen';

type AppProps = {
  authClient?: AuthStateClient;
  authService?: Pick<AuthService, 'signOut'>;
};

export const AppContent = ({
  authClient = getSupabaseClient().auth,
  authService,
}: AppProps = {}) => {
  const authSession = useAuthSession(authClient);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
    return (
      <>
        <AuthenticatedScreen
          error={signOutError}
          isSigningOut={isSigningOut}
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
});
