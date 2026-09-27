import type { SupabaseClient } from '@supabase/supabase-js';

import { GroupLifecycleService } from './groupLifecycleService';

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_GROUP_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const createClient = () => {
  const rpc = jest.fn();

  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('GroupLifecycleService', () => {
  it('グループ退出RPCを必要最小限の引数で呼び出す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: null });
    const service = new GroupLifecycleService(client);

    await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
      ok: true,
      result: { action: 'left', groupId: GROUP_ID },
    });
    expect(rpc).toHaveBeenCalledWith('leave_group', { p_group_id: GROUP_ID });
  });

  it('メンバー削除RPCを必要最小限の引数で呼び出す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: null });
    const service = new GroupLifecycleService(client);

    await expect(service.removeGroupMember(GROUP_ID, USER_ID)).resolves.toEqual(
      {
        ok: true,
        result: {
          action: 'member-removed',
          groupId: GROUP_ID,
          userId: USER_ID,
        },
      },
    );
    expect(rpc).toHaveBeenCalledWith('remove_group_member', {
      p_group_id: GROUP_ID,
      p_user_id: USER_ID,
    });
  });

  it('グループ解散RPCを必要最小限の引数で呼び出す', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: null });
    const service = new GroupLifecycleService(client);

    await expect(service.dissolveGroup(GROUP_ID)).resolves.toEqual({
      ok: true,
      result: { action: 'dissolved', groupId: GROUP_ID },
    });
    expect(rpc).toHaveBeenCalledWith('dissolve_group', {
      p_group_id: GROUP_ID,
    });
  });

  it.each([
    ['authentication_required', 'unauthenticated'],
    ['permission_denied', 'permission-denied'],
    ['owner_cannot_leave', 'owner-cannot-leave'],
    ['owner_cannot_be_removed', 'owner-cannot-be-removed'],
    ['group_not_found', 'group-not-found'],
    ['group_dissolved', 'group-dissolved'],
  ] as const)(
    'DBエラー「%s」を安全な失敗理由「%s」に変換する',
    async (message, reason) => {
      const { client, rpc } = createClient();
      rpc.mockResolvedValue({
        data: null,
        error: { message, details: 'secret detail', hint: 'secret hint' },
      });
      const service = new GroupLifecycleService(client);

      await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('退出時のmember_not_foundを退出済みとして扱う', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'member_not_found' },
    });
    const service = new GroupLifecycleService(client);

    await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
      ok: false,
      reason: 'already-left',
    });
  });

  it('メンバー削除時のmember_not_foundを対象不在として扱う', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'member_not_found' },
    });
    const service = new GroupLifecycleService(client);

    await expect(service.removeGroupMember(GROUP_ID, USER_ID)).resolves.toEqual(
      {
        ok: false,
        reason: 'member-not-found',
      },
    );
  });

  it.each([
    [{ code: '28000', message: 'database auth error' }, 'unauthenticated'],
    [{ code: 'PGRST301', message: 'jwt expired' }, 'unauthenticated'],
    [{ code: '42501', message: 'database policy error' }, 'permission-denied'],
  ] as const)(
    'エラーコードを安全な失敗理由へ変換する',
    async (error, reason) => {
      const { client, rpc } = createClient();
      rpc.mockResolvedValue({ data: null, error });
      const service = new GroupLifecycleService(client);

      await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
        ok: false,
        reason,
      });
    },
  );

  it('通信例外をnetworkへ変換する', async () => {
    const { client, rpc } = createClient();
    rpc.mockRejectedValue(
      new TypeError('Network request failed with secret URL'),
    );
    const service = new GroupLifecycleService(client);

    await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it('未知のエラーでSupabaseの内部情報を返さない', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'unknown database error',
        details: 'private table name',
        hint: 'internal function name',
      },
    });
    const service = new GroupLifecycleService(client);

    const result = await service.leaveGroup(GROUP_ID);

    expect(result).toEqual({ ok: false, reason: 'unexpected' });
    expect(JSON.stringify(result)).not.toContain('private table name');
    expect(JSON.stringify(result)).not.toContain('internal function name');
  });

  it('void RPCが値を返した場合は予期しない応答として扱う', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: { unexpected: true }, error: null });
    const service = new GroupLifecycleService(client);

    await expect(service.leaveGroup(GROUP_ID)).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
  });

  it('同じ操作の連打では同じ処理を共有しRPCを重複実行しない', async () => {
    const { client, rpc } = createClient();
    const deferred = createDeferred<{ data: null; error: null }>();
    rpc.mockReturnValue(deferred.promise);
    const service = new GroupLifecycleService(client);

    const first = service.leaveGroup(GROUP_ID);
    const second = service.leaveGroup(GROUP_ID);

    expect(second).toBe(first);
    expect(rpc).toHaveBeenCalledTimes(1);

    deferred.resolve({ data: null, error: null });
    await expect(first).resolves.toEqual({
      ok: true,
      result: { action: 'left', groupId: GROUP_ID },
    });
  });

  it('完了後の同じ操作は新しいRPCとして実行できる', async () => {
    const { client, rpc } = createClient();
    rpc.mockResolvedValue({ data: null, error: null });
    const service = new GroupLifecycleService(client);

    await service.leaveGroup(GROUP_ID);
    await service.leaveGroup(GROUP_ID);

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('対象または操作が異なる処理はそれぞれ実行する', async () => {
    const { client, rpc } = createClient();
    const deferred = createDeferred<{ data: null; error: null }>();
    rpc.mockReturnValue(deferred.promise);
    const service = new GroupLifecycleService(client);

    const requests = [
      service.leaveGroup(GROUP_ID),
      service.leaveGroup(OTHER_GROUP_ID),
      service.dissolveGroup(GROUP_ID),
    ];

    expect(rpc).toHaveBeenCalledTimes(3);
    deferred.resolve({ data: null, error: null });
    await Promise.all(requests);
  });
});
