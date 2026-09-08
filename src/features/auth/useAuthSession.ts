import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type AuthSessionUser = {
  id: string;
  email: string | null;
};

export type AuthSessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: AuthSessionUser };

export type AuthStateClient = {
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => {
    data: {
      subscription: {
        unsubscribe: () => void;
      };
    };
  };
};

export const useAuthSession = (
  authClient: AuthStateClient,
): AuthSessionState => {
  const [state, setState] = useState<AuthSessionState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    const { data } = authClient.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      if (!session) {
        setState({ status: 'unauthenticated' });
        return;
      }

      setState({
        status: 'authenticated',
        user: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
      });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [authClient]);

  return state;
};
