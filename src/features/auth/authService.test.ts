import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthUnknownError,
} from '@supabase/supabase-js';

import { createAuthService } from './authService';

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'user@example.com',
};

const createAuthClient = () => ({
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
});

describe('createAuthService', () => {
  test('メールアドレスとパスワードでサインアップし、安全なユーザー情報だけを返す', async () => {
    const auth = createAuthClient();
    auth.signUp.mockResolvedValue({
      data: {
        user,
        session: {
          access_token: 'access-token-must-not-be-returned',
          refresh_token: 'refresh-token-must-not-be-returned',
        },
      },
      error: null,
    });
    const service = createAuthService(auth as never);

    const result = await service.signUp({
      email: 'user@example.com',
      password: 'password-must-not-be-returned',
    });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password-must-not-be-returned',
    });
    expect(result).toEqual({ ok: true, user });
    expect(JSON.stringify(result)).not.toContain(
      'access-token-must-not-be-returned',
    );
    expect(JSON.stringify(result)).not.toContain(
      'refresh-token-must-not-be-returned',
    );
    expect(JSON.stringify(result)).not.toContain(
      'password-must-not-be-returned',
    );
  });

  test('登録済みユーザーをメールアドレスとパスワードでログインする', async () => {
    const auth = createAuthClient();
    auth.signInWithPassword.mockResolvedValue({
      data: {
        user,
        session: {
          access_token: 'login-access-token-must-not-be-returned',
          refresh_token: 'login-refresh-token-must-not-be-returned',
          expires_in: 3600,
          expires_at: 1_800_000_000,
          token_type: 'bearer',
          user,
        },
      },
      error: null,
    });
    const service = createAuthService(auth as never);

    const result = await service.signIn({
      email: 'user@example.com',
      password: 'password',
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password',
    });
    expect(result).toEqual({ ok: true, user });
    expect(JSON.stringify(result)).not.toContain(
      'login-access-token-must-not-be-returned',
    );
    expect(JSON.stringify(result)).not.toContain(
      'login-refresh-token-must-not-be-returned',
    );
  });

  test('ログアウトでは現在端末のセッションだけを終了する', async () => {
    const auth = createAuthClient();
    auth.signOut.mockResolvedValue({ error: null });
    const service = createAuthService(auth as never);

    const result = await service.signOut();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toEqual({ ok: true });
  });

  test('Supabase Authの認証失敗をauthenticationとして返す', async () => {
    const auth = createAuthClient();
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError(
        'Invalid login credentials',
        400,
        'invalid_credentials_access_token=access-secret',
      ),
    });
    const service = createAuthService(auth as never);

    const result = await service.signIn({
      email: 'user@example.com',
      password: 'wrong-password',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'authentication',
        message: '認証情報を確認してください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('access-secret');
  });

  test('Supabaseへ接続できない失敗をnetworkとして返す', async () => {
    const auth = createAuthClient();
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });
    const service = createAuthService(auth as never);

    const result = await service.signUp({
      email: 'user@example.com',
      password: 'password',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });

  test('予期しない例外を安全なエラーへ変換する', async () => {
    const auth = createAuthClient();
    auth.signOut.mockRejectedValue(
      new Error(
        'password=secret access_token=access-secret refresh_token=refresh-secret',
      ),
    );
    const service = createAuthService(auth as never);

    const result = await service.signOut();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message: '認証処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('Supabase内部の予期しない失敗をunexpectedとして返す', async () => {
    const auth = createAuthClient();
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthUnknownError(
        'password=secret access_token=access-secret',
        new SyntaxError('Unexpected response'),
      ),
    });
    const service = createAuthService(auth as never);

    const result = await service.signUp({
      email: 'user@example.com',
      password: 'secret',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message: '認証処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  test('成功レスポンスにユーザーがなければ安全なエラーを返す', async () => {
    const auth = createAuthClient();
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    const service = createAuthService(auth as never);

    const result = await service.signUp({
      email: 'user@example.com',
      password: 'password',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message: '認証処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
  });
});
