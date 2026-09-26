import { createProfileService } from './profileService';

const userId = '11111111-1111-1111-1111-111111111111';

const createClient = () => {
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const upsert = jest.fn();
  const from = jest.fn(() => ({ select, upsert }));
  const getSession = jest.fn().mockResolvedValue({
    data: { session: { user: { id: userId } } },
    error: null,
  });

  return {
    client: { auth: { getSession }, from },
    eq,
    from,
    getSession,
    maybeSingle,
    select,
    upsert,
  };
};

describe('createProfileService', () => {
  test('ログイン中のユーザー自身のプロフィールを取得する', async () => {
    const { client, eq, from, maybeSingle, select } = createClient();
    maybeSingle.mockResolvedValue({
      data: { user_id: userId, display_name: 'なおき' },
      error: null,
    });

    const result = await createProfileService(client as never).getMyProfile();

    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('user_id, display_name');
    expect(eq).toHaveBeenCalledWith('user_id', userId);
    expect(result).toEqual({
      ok: true,
      profile: { userId, displayName: 'なおき' },
    });
  });

  test('既存ユーザーにプロフィールがなければ正常な未設定状態を返す', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await createProfileService(client as never).getMyProfile();

    expect(result).toEqual({ ok: true, profile: null });
  });

  test.each(['', '   ', '1234567890123456', ' なおき'])(
    '不正な表示名「%s」をSupabaseへ送信せず拒否する',
    async (displayName) => {
      const { client, upsert } = createClient();

      const result = await createProfileService(
        client as never,
      ).saveDisplayName(displayName);

      expect(upsert).not.toHaveBeenCalled();
      expect(result).toEqual({
        ok: false,
        error: {
          type: 'invalid-name',
          message: '表示名は前後に空白を入れず、1〜15文字で入力してください。',
        },
      });
    },
  );

  test('本人の表示名を保存してアプリ用の形式で返す', async () => {
    const { client, from, upsert } = createClient();
    upsert.mockResolvedValue({ data: null, error: null });

    const result = await createProfileService(client as never).saveDisplayName(
      'なおき',
    );

    expect(from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: userId, display_name: 'なおき' },
      { onConflict: 'user_id' },
    );
    expect(result).toEqual({
      ok: true,
      profile: { userId, displayName: 'なおき' },
    });
  });

  test('未ログインではプロフィールを問い合わせない', async () => {
    const { client, from, getSession } = createClient();
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await createProfileService(client as never).getMyProfile();

    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unauthenticated',
        message: 'ログインが必要です。再度ログインしてください。',
      },
    });
  });

  test('通信失敗を安全なエラーへ変換する', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockRejectedValue(new TypeError('Network request failed'));

    const result = await createProfileService(client as never).getMyProfile();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });
});
