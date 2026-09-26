import { createGroupService } from './groupService';

type ClientError = {
  code: string;
  message: string;
  details: string;
  hint: string;
};

const createClient = () => {
  const order = jest.fn();
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq, order }));
  const profilesIn = jest.fn().mockResolvedValue({
    data: [
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        display_name: 'なおき',
      },
      {
        user_id: '00000000-0000-0000-0000-000000000002',
        display_name: 'あや',
      },
    ],
    error: null,
  });
  const profilesSelect = jest.fn(() => ({ in: profilesIn }));
  const from = jest.fn((table: string) =>
    table === 'profiles' ? { select: profilesSelect } : { select },
  );
  const rpc = jest.fn();
  const getSession = jest.fn().mockResolvedValue({
    data: {
      session: {
        access_token: 'access-token-must-not-be-returned',
        user: { id: '00000000-0000-0000-0000-000000000001' },
      },
    },
    error: null,
  });

  return {
    client: { auth: { getSession }, from, rpc },
    eq,
    from,
    getSession,
    maybeSingle,
    order,
    profilesIn,
    profilesSelect,
    rpc,
    select,
  };
};

const databaseError = (overrides: Partial<ClientError> = {}): ClientError => ({
  code: 'XX000',
  message: 'internal database failure',
  details: 'password=secret access_token=access-secret',
  hint: 'select * from private.data',
  ...overrides,
});

describe('createGroupService', () => {
  test('DB関数でグループを作成し新しいIDだけを返す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: '40000000-0000-0000-0000-000000000001',
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.createGroup('家族');

    expect(rpc).toHaveBeenCalledWith('create_group', { p_name: '家族' });
    expect(result).toEqual({
      ok: true,
      groupId: '40000000-0000-0000-0000-000000000001',
    });
  });

  test('所属グループだけを取得してアプリ用の形式へ変換する', async () => {
    const { client, from, order, select } = createClient();
    order.mockResolvedValue({
      data: [
        {
          id: '40000000-0000-0000-0000-000000000001',
          name: '家族',
          created_by: '00000000-0000-0000-0000-000000000001',
          created_at: '2026-09-19T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.listGroups();

    expect(from).toHaveBeenCalledWith('groups');
    expect(select).toHaveBeenCalledWith('id, name, created_by, created_at');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual({
      ok: true,
      groups: [
        {
          id: '40000000-0000-0000-0000-000000000001',
          name: '家族',
          createdBy: '00000000-0000-0000-0000-000000000001',
          createdAt: '2026-09-19T00:00:00.000Z',
        },
      ],
    });
  });

  test('所属グループがなければ正常な空配列を返す', async () => {
    const { client, order } = createClient();
    order.mockResolvedValue({ data: [], error: null });
    const service = createGroupService(client as never);

    const result = await service.listGroups();

    expect(result).toEqual({ ok: true, groups: [] });
  });

  test('グループ詳細と現在のメンバーをアプリ用の形式へ変換する', async () => {
    const { client, eq, from, maybeSingle, select } = createClient();
    maybeSingle.mockResolvedValue({
      data: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        created_by: '00000000-0000-0000-0000-000000000001',
        created_at: '2026-09-19T00:00:00.000Z',
        group_members: [
          {
            user_id: '00000000-0000-0000-0000-000000000001',
            joined_at: '2026-09-19T00:00:00.000Z',
          },
          {
            user_id: '00000000-0000-0000-0000-000000000002',
            joined_at: '2026-09-20T00:00:00.000Z',
          },
        ],
      },
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(from).toHaveBeenCalledWith('groups');
    expect(select).toHaveBeenCalledWith(
      'id, name, created_by, created_at, group_members(user_id, joined_at)',
    );
    expect(eq).toHaveBeenCalledWith(
      'id',
      '40000000-0000-0000-0000-000000000001',
    );
    expect(result).toEqual({
      ok: true,
      group: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        createdBy: '00000000-0000-0000-0000-000000000001',
        createdAt: '2026-09-19T00:00:00.000Z',
        members: [
          {
            userId: '00000000-0000-0000-0000-000000000001',
            displayName: 'なおき',
            role: 'owner',
            joinedAt: '2026-09-19T00:00:00.000Z',
          },
          {
            userId: '00000000-0000-0000-0000-000000000002',
            displayName: 'あや',
            role: 'member',
            joinedAt: '2026-09-20T00:00:00.000Z',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain(
      'access-token-must-not-be-returned',
    );
  });

  test('プロフィールがないメンバーは表示名をnullとして返す', async () => {
    const { client, maybeSingle, profilesIn } = createClient();
    maybeSingle.mockResolvedValue({
      data: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        created_by: '00000000-0000-0000-0000-000000000001',
        created_at: '2026-09-19T00:00:00.000Z',
        group_members: [
          {
            user_id: '00000000-0000-0000-0000-000000000001',
            joined_at: '2026-09-19T00:00:00.000Z',
          },
        ],
      },
      error: null,
    });
    profilesIn.mockResolvedValue({ data: [], error: null });

    const result = await createGroupService(client as never).getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: true,
      group: expect.objectContaining({
        members: [
          expect.objectContaining({
            userId: '00000000-0000-0000-0000-000000000001',
            displayName: null,
          }),
        ],
      }),
    });
  });

  test('未ログインではグループ詳細を問い合わせない', async () => {
    const { client, from, getSession } = createClient();
    getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unauthenticated',
        message: 'ログインが必要です。再度ログインしてください。',
      },
    });
    expect(from).not.toHaveBeenCalled();
  });

  test('RLSで見えないグループは安全な権限エラーを返す', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000099',
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'permission-denied',
        message: 'このグループの情報を表示する権限がありません。',
      },
    });
  });

  test('メンバーがいない応答は正常な空配列として扱う', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockResolvedValue({
      data: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        created_by: '00000000-0000-0000-0000-000000000001',
        created_at: '2026-09-19T00:00:00.000Z',
        group_members: [],
      },
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: true,
      group: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        createdBy: '00000000-0000-0000-0000-000000000001',
        createdAt: '2026-09-19T00:00:00.000Z',
        members: [],
      },
    });
  });

  test('グループ詳細取得の通信例外をnetworkとして返す', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockRejectedValue(new TypeError('Network request failed'));
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });

  test('グループ詳細の不正なメンバー形式を安全なエラーへ変換する', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockResolvedValue({
      data: {
        id: '40000000-0000-0000-0000-000000000001',
        name: '家族',
        created_by: '00000000-0000-0000-0000-000000000001',
        created_at: '2026-09-19T00:00:00.000Z',
        group_members: [{ user_id: null, joined_at: 'invalid-member-secret' }],
      },
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'グループ情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('invalid-member-secret');
  });

  test('グループ詳細のDBエラーから内部情報を除いて返す', async () => {
    const { client, maybeSingle } = createClient();
    maybeSingle.mockResolvedValue({ data: null, error: databaseError() });
    const service = createGroupService(client as never);

    const result = await service.getGroupDetails(
      '40000000-0000-0000-0000-000000000001',
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'グループ情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test.each([
    {
      name: '未認証',
      error: databaseError({
        code: '28000',
        message: 'authentication required',
      }),
      expected: {
        type: 'unauthenticated',
        message: 'ログインが必要です。再度ログインしてください。',
      },
    },
    {
      name: 'グループ名不正',
      error: databaseError({
        code: '22023',
        message:
          'group name must be 1 to 100 characters without surrounding whitespace',
      }),
      expected: {
        type: 'invalid-name',
        message:
          'グループ名は前後に空白を入れず、1〜100文字で入力してください。',
      },
    },
    {
      name: '5グループ上限',
      error: databaseError({
        code: '22023',
        message: 'group creation limit reached',
      }),
      expected: {
        type: 'group-limit',
        message: '作成できるグループは5件までです。',
      },
    },
    {
      name: '権限拒否',
      error: databaseError({
        code: '42501',
        message: 'permission denied for table groups',
      }),
      expected: {
        type: 'permission-denied',
        message: 'グループを操作する権限がありません。',
      },
    },
    {
      name: '通信失敗',
      error: databaseError({
        code: '',
        message: 'TypeError: Network request failed',
      }),
      expected: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    },
  ])('$nameを安全な作成エラーへ変換する', async ({ error, expected }) => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error });
    const service = createGroupService(client as never);

    const result = await service.createGroup('家族');

    expect(result).toEqual({ ok: false, error: expected });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test('一覧取得の通信例外をnetworkとして返す', async () => {
    const { client, order } = createClient();
    order.mockRejectedValue(new TypeError('The request timed out'));
    const service = createGroupService(client as never);

    const result = await service.listGroups();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });
  });

  test('予期しないDBエラーから内部情報を除いて返す', async () => {
    const { client, order } = createClient();
    order.mockResolvedValue({ data: null, error: databaseError() });
    const service = createGroupService(client as never);

    const result = await service.listGroups();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'グループ情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('select *');
  });

  test('DBレスポンスの形式が不正なら安全なエラーを返す', async () => {
    const { client, order } = createClient();
    order.mockResolvedValue({
      data: [{ id: 'group-id', name: null }],
      error: null,
    });
    const service = createGroupService(client as never);

    const result = await service.listGroups();

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          'グループ情報の処理に失敗しました。時間をおいて再度お試しください。',
      },
    });
  });
});
