import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { AuthService } from '../features/auth/authService';
import { AuthScreen } from './AuthScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const createAuthService = (
  overrides: Partial<AuthService> = {},
): AuthService => ({
  signIn: jest.fn().mockResolvedValue({
    ok: true,
    user: { id: 'user-id', email: 'memory@example.com' },
  }),
  signUp: jest.fn().mockResolvedValue({
    ok: true,
    user: { id: 'user-id', email: 'memory@example.com' },
  }),
  signOut: jest.fn().mockResolvedValue({ ok: true }),
  ...overrides,
});

describe('<AuthScreen />', () => {
  test('パスワードを画面上で伏字にする', async () => {
    await render(<AuthScreen authService={createAuthService()} />);

    expect(screen.getByLabelText('パスワード').props.secureTextEntry).toBe(
      true,
    );
  });

  test('有効なログイン情報を正規化して送信し成功を表示する', async () => {
    const signIn = jest.fn().mockResolvedValue({
      ok: true,
      user: { id: 'user-id', email: 'memory@example.com' },
    });
    const authService = createAuthService({ signIn });

    await render(<AuthScreen authService={authService} />);

    await fireEvent.changeText(
      screen.getByLabelText('メールアドレス'),
      '  memory@example.com  ',
    );
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        email: 'memory@example.com',
        password: 'secret1',
      });
    });
    expect(screen.getByText('ログインしました')).toBeTruthy();
  });

  test.each([
    {
      name: 'メールアドレスが空',
      email: '',
      password: 'secret1',
      error: 'メールアドレスを入力してください',
    },
    {
      name: 'メールアドレスの形式が不正',
      email: 'not-an-email',
      password: 'secret1',
      error: '正しい形式のメールアドレスを入力してください',
    },
    {
      name: 'パスワードが空',
      email: 'memory@example.com',
      password: '',
      error: 'パスワードを入力してください',
    },
    {
      name: 'パスワードが5文字',
      email: 'memory@example.com',
      password: '12345',
      error: 'パスワードは6文字以上で入力してください',
    },
  ])(
    '$nameの場合は認証せず理由を表示する',
    async ({ email, password, error }) => {
      const signIn = jest.fn().mockResolvedValue({
        ok: true,
        user: { id: 'user-id', email: 'memory@example.com' },
      });
      const authService = createAuthService({ signIn });

      await render(<AuthScreen authService={authService} />);

      if (email) {
        await fireEvent.changeText(
          screen.getByLabelText('メールアドレス'),
          email,
        );
      }
      if (password) {
        await fireEvent.changeText(
          screen.getByLabelText('パスワード'),
          password,
        );
      }
      await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

      expect(signIn).not.toHaveBeenCalled();
      expect(screen.getByText(error)).toBeTruthy();
    },
  );

  test('サインアップへ切り替えて登録情報を送信する', async () => {
    const signIn = jest.fn();
    const signUp = jest.fn().mockResolvedValue({
      ok: true,
      user: { id: 'user-id', email: 'new@example.com' },
    });
    const authService = createAuthService({ signIn, signUp });

    await render(<AuthScreen authService={authService} />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'アカウントを作成' }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('メールアドレス'),
      'new@example.com',
    );
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: '登録する' }));

    expect(signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret1',
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(
      screen.getByText('登録を受け付けました。確認メールをご確認ください。'),
    ).toBeTruthy();
  });

  test.each([
    {
      type: 'authentication' as const,
      message: '認証情報を確認してください。',
    },
    {
      type: 'network' as const,
      message: '通信に失敗しました。接続を確認して再度お試しください。',
    },
  ])('$typeエラーを利用者へ表示する', async ({ type, message }) => {
    const authService = createAuthService({
      signIn: jest.fn().mockResolvedValue({
        ok: false,
        error: { type, message },
      }),
    });

    await render(<AuthScreen authService={authService} />);

    await fireEvent.changeText(
      screen.getByLabelText('メールアドレス'),
      'memory@example.com',
    );
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'secret1');
    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    expect(screen.getByText(message)).toBeTruthy();
  });

  test('送信中は処理中表示にして多重送信を防ぐ', async () => {
    let resolveSignIn!: (
      result: Awaited<ReturnType<AuthService['signIn']>>,
    ) => void;
    const signIn = jest.fn(
      () =>
        new Promise<Awaited<ReturnType<AuthService['signIn']>>>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const authService = createAuthService({ signIn });

    await render(<AuthScreen authService={authService} />);
    await fireEvent.changeText(
      screen.getByLabelText('メールアドレス'),
      'memory@example.com',
    );
    await fireEvent.changeText(screen.getByLabelText('パスワード'), 'secret1');

    await fireEvent.press(screen.getByRole('button', { name: 'ログイン' }));

    const disabledButton = screen.getByRole('button', {
      name: 'ログイン',
      disabled: true,
    });
    expect(screen.getByLabelText('認証処理中')).toBeTruthy();

    await fireEvent.press(disabledButton);
    expect(signIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSignIn({
        ok: true,
        user: { id: 'user-id', email: 'memory@example.com' },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByText('ログインしました')).toBeTruthy();
    });
  });
});
