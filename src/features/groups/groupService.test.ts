import { createGroupService } from './groupService';

type ClientError = {
  code: string;
  message: string;
  details: string;
  hint: string;
};

const createClient = () => {
  const order = jest.fn();
  const select = jest.fn(() => ({ order }));
  const from = jest.fn(() => ({ select }));
  const rpc = jest.fn();

  return { client: { from, rpc }, from, order, rpc, select };
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
