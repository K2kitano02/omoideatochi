import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { AppContent } from '../App';
import type { AuthStateClient } from '../src/features/auth/useAuthSession';

const mockListOwnedGroupPendingCounts = jest.fn();
const mockGetMyProfile = jest.fn();
const mockSaveDisplayName = jest.fn();

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('../src/features/profile/profiles', () => ({
  getProfileService: () => ({
    getMyProfile: mockGetMyProfile,
    saveDisplayName: mockSaveDisplayName,
  }),
}));
jest.mock('../src/features/groups/groups', () => ({
  getGroupService: () => ({
    createGroup: jest.fn().mockResolvedValue({
      ok: true,
      groupId: '33333333-3333-3333-3333-333333333333',
    }),
    getGroupDetails: jest.fn().mockResolvedValue({
      ok: true,
      group: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        createdBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
        createdAt: '2026-09-19T00:00:00.000Z',
        members: [
          {
            userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
            role: 'owner',
            joinedAt: '2026-09-19T00:00:00.000Z',
          },
        ],
      },
    }),
    listGroups: jest.fn().mockResolvedValue({
      ok: true,
      groups: [
        {
          id: '40000000-0000-0000-0000-000000000001',
          name: '家族',
          createdBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
          createdAt: '2026-09-19T00:00:00.000Z',
        },
      ],
    }),
  }),
}));
jest.mock('../src/features/groups/groupInvitations', () => ({
  getGroupInvitationService: () => ({
    cancelJoinRequest: jest.fn().mockResolvedValue({ ok: true }),
    createInvitation: jest.fn().mockResolvedValue({
      ok: true,
      invitation: {
        token: 'a'.repeat(64),
        expiresAt: '2026-09-21T12:10:00.000Z',
        requiresApproval: true,
      },
    }),
    listJoinRequests: jest.fn().mockResolvedValue({ ok: true, requests: [] }),
    listMyJoinRequests: jest.fn().mockResolvedValue({ ok: true, requests: [] }),
    listOwnedGroupPendingCounts: mockListOwnedGroupPendingCounts,
    previewInvitation: jest.fn(),
    redeemInvitation: jest.fn(),
    resolveJoinRequest: jest.fn(),
  }),
}));

const session: Session = {
  access_token: 'access-token-must-not-be-rendered',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  refresh_token: 'refresh-token-must-not-be-rendered',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    email_confirmed_at: '2026-09-06T00:00:00.000Z',
    phone: '',
    confirmed_at: '2026-09-06T00:00:00.000Z',
    last_sign_in_at: '2026-09-06T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
    is_anonymous: false,
  },
};

const createAuthClient = () => {
  let callback:
    | ((event: AuthChangeEvent, currentSession: Session | null) => void)
    | undefined;
  const unsubscribe = jest.fn();
  const onAuthStateChange = jest.fn((nextCallback) => {
    callback = nextCallback;

    return { data: { subscription: { unsubscribe } } };
  });
  const authClient: AuthStateClient = {
    onAuthStateChange,
  };

  return {
    authClient,
    emit: async (
      currentSession: Session | null,
      event: AuthChangeEvent = 'INITIAL_SESSION',
    ) => {
      await act(async () => {
        callback?.(event, currentSession);
      });
    },
    onAuthStateChange,
    unsubscribe,
  };
};

describe('<AppContent />', () => {
  beforeEach(() => {
    mockListOwnedGroupPendingCounts.mockReset().mockResolvedValue({
      ok: true,
      counts: [],
    });
    mockGetMyProfile.mockReset().mockResolvedValue({
      ok: true,
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'なおき',
      },
    });
    mockSaveDisplayName.mockReset().mockResolvedValue({
      ok: true,
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'なおき',
      },
    });
  });

  test('既存ユーザーにプロフィールがなければ表示名設定を完了するまで地図を表示しない', async () => {
    mockGetMyProfile.mockResolvedValue({ ok: true, profile: null });
    mockSaveDisplayName.mockResolvedValue({
      ok: true,
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        displayName: 'なおき',
      },
    });
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);

    await emit(session);

    expect(await screen.findByLabelText('表示名初期設定画面')).toBeTruthy();
    expect(screen.queryByLabelText('地図画面')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('表示名'), 'なおき');
    await fireEvent.press(
      screen.getByRole('button', { name: '表示名を設定する' }),
    );

    expect(await screen.findByLabelText('地図画面')).toBeTruthy();
  });

  test('プロフィール取得エラー画面からログアウトでき失敗理由も確認できる', async () => {
    mockGetMyProfile.mockResolvedValue({
      ok: false,
      error: {
        type: 'network',
        message: 'プロフィールを取得できませんでした。',
      },
    });
    const authService = {
      signOut: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'network' as const,
          message: 'ログアウトできませんでした。',
        },
      }),
    };
    const { authClient, emit } = createAuthClient();
    await render(
      <AppContent authClient={authClient} authService={authService} />,
    );

    await emit(session);

    expect(
      await screen.findByLabelText('プロフィール読み込みエラー'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('ログアウトできませんでした。'),
    ).toBeTruthy();
  });

  test('初期セッションの確認中は認証画面を表示しない', async () => {
    const { authClient } = createAuthClient();

    await render(<AppContent authClient={authClient} />);

    expect(screen.getByLabelText('認証状態を確認中')).toBeTruthy();
    expect(screen.queryByLabelText('メールアドレス')).toBeNull();
  });

  test('初期セッションがなければ認証画面を表示する', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);

    await emit(null);

    expect(screen.getByLabelText('メールアドレス')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();
  });

  test('初期セッションがあれば地図画面を初期表示する', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);

    await emit(session);

    expect(screen.getByLabelText('地図画面')).toBeTruthy();
    expect(screen.queryByLabelText('グループ画面')).toBeNull();
    expect(screen.queryByLabelText('メールアドレス')).toBeNull();
  });

  test('認証済みタブから各プレースホルダーへ移動して地図へ戻れる', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(session);

    await fireEvent.press(screen.getByLabelText('グループタブ'));
    expect(screen.getByLabelText('グループ画面')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('コレクションタブ'));
    expect(screen.getByLabelText('コレクション画面')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('地図タブ'));
    expect(screen.getByLabelText('地図画面')).toBeTruthy();
  });

  test('承認待ち件数をグループタブと対象グループへ表示する', async () => {
    mockListOwnedGroupPendingCounts.mockResolvedValue({
      ok: true,
      counts: [
        {
          groupId: '40000000-0000-0000-0000-000000000001',
          pendingCount: 3,
        },
      ],
    });
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);

    await emit(session);

    expect(
      await screen.findByLabelText('グループタブ、承認待ち3件'),
    ).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('グループタブ、承認待ち3件'));
    expect(await screen.findByText('承認待ち 3件')).toBeTruthy();
  });

  test('グループ一覧から詳細へ移動し、一覧へ戻れる', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(session);

    await fireEvent.press(screen.getByLabelText('グループタブ'));
    await fireEvent.press(
      await screen.findByRole('button', { name: '家族の詳細を開く' }),
    );

    expect(await screen.findByLabelText('グループ詳細画面')).toBeTruthy();
    expect(screen.getByRole('header', { name: '家族' })).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'グループ一覧に戻る' }),
    );

    expect(await screen.findByLabelText('グループ画面')).toBeTruthy();
  });

  test('グループ一覧から招待コード参加画面へ移動して戻れる', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(session);

    await fireEvent.press(screen.getByLabelText('グループタブ'));
    await fireEvent.press(
      screen.getByRole('button', { name: '招待コードで参加' }),
    );

    expect(await screen.findByLabelText('招待コード参加画面')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'グループ一覧に戻る' }),
    );
    expect(await screen.findByLabelText('グループ画面')).toBeTruthy();
  });

  test('グループ詳細から招待管理画面へ移動する', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(session);

    await fireEvent.press(screen.getByLabelText('グループタブ'));
    await fireEvent.press(
      await screen.findByRole('button', { name: '家族の詳細を開く' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'メンバーを招待' }),
    );

    expect(await screen.findByLabelText('招待管理画面')).toBeTruthy();
    expect(screen.getByText('10分間だけ使える招待コード')).toBeTruthy();
  });

  test('設定画面でログイン中のアカウントを確認できる', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(session);

    await fireEvent.press(screen.getByLabelText('設定タブ'));

    expect(screen.getByLabelText('設定画面')).toBeTruthy();
    expect(screen.getByText('user@example.com でログイン中')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeTruthy();
  });

  test('ログインイベントを受け取ると認証画面からログイン後の画面へ切り替える', async () => {
    const { authClient, emit } = createAuthClient();
    await render(<AppContent authClient={authClient} />);
    await emit(null);

    await emit(session, 'SIGNED_IN');

    expect(screen.getByLabelText('地図画面')).toBeTruthy();
  });

  test('ログアウト後の認証イベントで認証画面へ戻る', async () => {
    const { authClient, emit } = createAuthClient();
    const authService = {
      signOut: jest.fn().mockResolvedValue({ ok: true } as const),
    };
    await render(
      <AppContent authClient={authClient} authService={authService} />,
    );
    await emit(session);

    await fireEvent.press(screen.getByLabelText('設定タブ'));

    await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    await emit(null, 'SIGNED_OUT');
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();
  });

  test('ログアウトに失敗したらログイン状態を保って安全なエラーを表示する', async () => {
    const { authClient, emit } = createAuthClient();
    const authService = {
      signOut: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'network' as const,
          message: '通信に失敗しました。接続を確認して再度お試しください。',
        },
      }),
    };
    await render(
      <AppContent authClient={authClient} authService={authService} />,
    );
    await emit(session);

    await fireEvent.press(screen.getByLabelText('設定タブ'));

    await fireEvent.press(screen.getByRole('button', { name: 'ログアウト' }));

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        '通信に失敗しました。接続を確認して再度お試しください。',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('設定画面')).toBeTruthy();
  });

  test('認証監視を重複登録せず、アプリのアンマウント時に解除する', async () => {
    const { authClient, onAuthStateChange, unsubscribe } = createAuthClient();
    const view = await render(<AppContent authClient={authClient} />);

    await view.rerender(<AppContent authClient={authClient} />);

    expect(onAuthStateChange).toHaveBeenCalledTimes(1);

    await view.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
