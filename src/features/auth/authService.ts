import {
  AuthUnknownError,
  isAuthError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';

type Credentials = {
  email: string;
  password: string;
};

type AuthUserData = {
  id: string;
  email?: string;
};

type UserAuthResponse = {
  data: {
    user: AuthUserData | null;
  };
  error: unknown;
};

type AuthClient = {
  signUp: (credentials: Credentials) => Promise<UserAuthResponse>;
  signInWithPassword: (credentials: Credentials) => Promise<UserAuthResponse>;
  signOut: (options: { scope: 'local' }) => Promise<{ error: unknown }>;
};

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthFailure = {
  type: 'authentication' | 'network' | 'unexpected';
  message: string;
};

export type UserAuthResult =
  { ok: true; user: AuthUser } | { ok: false; error: AuthFailure };

export type SignOutResult = { ok: true } | { ok: false; error: AuthFailure };

const unexpectedFailure = (): AuthFailure => ({
  type: 'unexpected',
  message: '認証処理に失敗しました。時間をおいて再度お試しください。',
});

const toAuthFailure = (error: unknown): AuthFailure => {
  if (isAuthRetryableFetchError(error)) {
    return {
      type: 'network',
      message: '通信に失敗しました。接続を確認して再度お試しください。',
    };
  }

  if (error instanceof AuthUnknownError) {
    return unexpectedFailure();
  }

  if (isAuthError(error)) {
    return {
      type: 'authentication',
      message: '認証情報を確認してください。',
    };
  }

  return unexpectedFailure();
};

const runUserAuth = async (
  operation: () => Promise<UserAuthResponse>,
): Promise<UserAuthResult> => {
  try {
    const { data, error } = await operation();

    if (error) {
      return { ok: false, error: toAuthFailure(error) };
    }

    if (!data.user) {
      return { ok: false, error: unexpectedFailure() };
    }

    return {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: toAuthFailure(error) };
  }
};

export const createAuthService = (auth: AuthClient) => ({
  signUp: (credentials: Credentials): Promise<UserAuthResult> =>
    runUserAuth(() => auth.signUp(credentials)),

  signIn: (credentials: Credentials): Promise<UserAuthResult> =>
    runUserAuth(() => auth.signInWithPassword(credentials)),

  signOut: async (): Promise<SignOutResult> => {
    try {
      const { error } = await auth.signOut({ scope: 'local' });

      if (error) {
        return { ok: false, error: toAuthFailure(error) };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: toAuthFailure(error) };
    }
  },
});

export type AuthService = ReturnType<typeof createAuthService>;
