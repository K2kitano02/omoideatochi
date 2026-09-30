import { getFriendService } from './friends';

const rpc = jest.fn();
const mockGetSupabaseClient = jest.fn(() => ({ rpc }));

jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

describe('getFriendService', () => {
  test('共通クライアントで作成した同じserviceを再利用する', async () => {
    rpc.mockResolvedValue({
      data: 'AB12CD34EF56AB78',
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    const first = getFriendService();
    const second = getFriendService();

    expect(first).toBe(second);
    await expect(first.getMyFriendCode()).resolves.toEqual({
      ok: true,
      code: 'AB12CD34EF56AB78',
    });
    expect(rpc).toHaveBeenCalledWith('get_my_friend_code');
  });
});
