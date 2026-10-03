import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { FriendService } from '../features/friends/friendService';
import { FriendsScreen } from './FriendsScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const code = '0123456789ABCDEF';
const otherCode = 'FEDCBA9876543210';
const request = {
  requestId: '11111111-1111-1111-1111-111111111111',
  user: { displayName: '山田太郎' },
  createdAt: '2026-10-03T00:00:00Z',
};
const friend = {
  relationshipId: '22222222-2222-2222-2222-222222222222',
  user: { displayName: '佐藤花子' },
  acceptedAt: '2026-10-03T00:00:00Z',
};
const network = {
  ok: false as const,
  error: {
    type: 'network' as const,
    message: '通信に失敗しました。接続を確認して再度お試しください。',
  },
};

const createService = (
  overrides: Partial<FriendService> = {},
): FriendService => ({
  getMyFriendCode: jest.fn().mockResolvedValue({ ok: true, code }),
  regenerateMyFriendCode: jest
    .fn()
    .mockResolvedValue({ ok: true, code: otherCode }),
  previewFriendCode: jest
    .fn()
    .mockResolvedValue({ ok: true, user: request.user }),
  createFriendRequest: jest
    .fn()
    .mockResolvedValue({ ok: true, requestId: request.requestId }),
  listReceivedFriendRequests: jest
    .fn()
    .mockResolvedValue({ ok: true, requests: [] }),
  listSentFriendRequests: jest
    .fn()
    .mockResolvedValue({ ok: true, requests: [] }),
  resolveFriendRequest: jest
    .fn()
    .mockResolvedValue({ ok: true, status: 'accepted' }),
  listFriends: jest.fn().mockResolvedValue({ ok: true, friends: [] }),
  removeFriend: jest.fn().mockResolvedValue({ ok: true }),
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const press = async (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));
const open = async (
  friendService = createService(),
  copyText = jest.fn().mockResolvedValue(true),
) => {
  const view = await render(
    <FriendsScreen friendService={friendService} copyText={copyText} />,
  );
  await screen.findByText(code);
  return view;
};
const preview = async () => {
  await fireEvent.changeText(
    screen.getByLabelText('相手のフレンドコード'),
    otherCode,
  );
  await press('相手を確認');
  await screen.findByText('山田太郎');
};

describe('<FriendsScreen />', () => {
  test('自分のコードと空状態を表示し、操作した時だけコードをコピーする', async () => {
    const copyText = jest.fn().mockResolvedValue(true);
    await open(createService(), copyText);
    expect(copyText).not.toHaveBeenCalled();
    expect(screen.getByText('まだフレンドはいません')).toBeTruthy();
    expect(screen.getByText('受信した申請はありません')).toBeTruthy();
    expect(screen.getByText('送信済みの申請はありません')).toBeTruthy();
    await press('自分のコードをコピー');
    expect(copyText).toHaveBeenCalledWith(code);
    expect(await screen.findByText('コードをコピーしました。')).toBeTruthy();
  });

  test.each([false, new Error('clipboard unavailable')])(
    'コピー失敗を表示する: %s',
    async (failure) => {
      const copyText = jest.fn(() =>
        failure === false ? Promise.resolve(false) : Promise.reject(failure),
      );
      await open(createService(), copyText);
      await press('自分のコードをコピー');
      expect(
        await screen.findByText('コピーできませんでした。再度お試しください。'),
      ).toBeTruthy();
    },
  );

  test('再生成の確認でキャンセルしてもコードを変更しない', async () => {
    const service = createService();
    await open(service);
    await press('コードを再生成');
    expect(
      screen.getByText(
        '再生成すると古いコードは使えなくなります。フレンド関係や送信済みの申請は変わりません。',
      ),
    ).toBeTruthy();
    expect(service.regenerateMyFriendCode).not.toHaveBeenCalled();
    await press('キャンセル');
    expect(screen.getByText(code)).toBeTruthy();
    expect(service.regenerateMyFriendCode).not.toHaveBeenCalled();
  });

  test('確認後に再生成し、新しいコードを表示する', async () => {
    await open();
    await press('コードを再生成');
    await press('再生成する');
    expect(await screen.findByText(otherCode)).toBeTruthy();
    expect(screen.queryByText(code)).toBeNull();
  });

  test('表示名を確認してから、確認したコードで申請を送り一覧を更新する', async () => {
    const service = createService({
      listSentFriendRequests: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, requests: [] })
        .mockResolvedValue({ ok: true, requests: [request] }),
    });
    await open(service);
    expect(screen.queryByRole('button', { name: '申請を送る' })).toBeNull();
    await preview();
    expect(service.createFriendRequest).not.toHaveBeenCalled();
    await press('申請を送る');
    expect(service.createFriendRequest).toHaveBeenCalledWith(otherCode);
    expect(await screen.findByText('申請中')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '申請を送る' })).toBeNull();
  });

  test('確認後に入力を変更したら古い相手への申請はできない', async () => {
    await open();
    await preview();
    await fireEvent.changeText(
      screen.getByLabelText('相手のフレンドコード'),
      code,
    );
    expect(screen.queryByText('山田太郎')).toBeNull();
    expect(screen.queryByRole('button', { name: '申請を送る' })).toBeNull();
  });

  test('相手の確認中に入力を変えても、遅れて返った相手を表示しない', async () => {
    const pending =
      deferred<Awaited<ReturnType<FriendService['previewFriendCode']>>>();
    await open(
      createService({ previewFriendCode: jest.fn(() => pending.promise) }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('相手のフレンドコード'),
      otherCode,
    );
    await press('相手を確認');
    await fireEvent.changeText(
      screen.getByLabelText('相手のフレンドコード'),
      code,
    );
    await act(async () => pending.resolve({ ok: true, user: request.user }));
    expect(screen.queryByText('山田太郎')).toBeNull();
    expect(screen.queryByRole('button', { name: '申請を送る' })).toBeNull();
  });

  test('不正なコードを送らず入力方法を表示する', async () => {
    const service = createService();
    await open(service);
    await fireEvent.changeText(
      screen.getByLabelText('相手のフレンドコード'),
      'invalid',
    );
    await press('相手を確認');
    expect(
      screen.getByText(
        'フレンドコードは16文字の半角英数字（0〜9、A〜F）で入力してください。',
      ),
    ).toBeTruthy();
    expect(service.previewFriendCode).not.toHaveBeenCalled();
  });

  test.each([
    ['friend-code-not-found', 'フレンドコードが見つかりません。'],
    ['cannot-friend-self', '自分自身へフレンド申請は送れません。'],
    ['permission-denied', 'この操作を行う権限がありません。'],
  ])('相手確認のエラーを表示する: %s', async (type, message) => {
    await open(
      createService({
        previewFriendCode: jest
          .fn()
          .mockResolvedValue({ ok: false, error: { type, message } }),
      }),
    );
    await fireEvent.changeText(
      screen.getByLabelText('相手のフレンドコード'),
      otherCode,
    );
    await press('相手を確認');
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '申請を送る' })).toBeNull();
  });

  test.each([
    [
      'request-already-pending',
      'このユーザーへのフレンド申請はすでに処理待ちです。',
    ],
    ['already-friends', 'このユーザーとはすでにフレンドです。'],
    ['network', '通信に失敗しました。接続を確認して再度お試しください。'],
  ])('申請エラーで成功表示せず理由を伝える: %s', async (type, message) => {
    await open(
      createService({
        createFriendRequest: jest
          .fn()
          .mockResolvedValue({ ok: false, error: { type, message } }),
      }),
    );
    await preview();
    await press('申請を送る');
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText('フレンド申請を送りました。')).toBeNull();
  });

  test.each([true, false])(
    '受信申請を処理し一覧を更新する: 承認=%s',
    async (accept) => {
      const service = createService({
        listReceivedFriendRequests: jest
          .fn()
          .mockResolvedValueOnce({ ok: true, requests: [request] })
          .mockResolvedValue({ ok: true, requests: [] }),
        resolveFriendRequest: jest.fn().mockResolvedValue({
          ok: true,
          status: accept ? 'accepted' : 'rejected',
        }),
        listFriends: jest
          .fn()
          .mockResolvedValueOnce({ ok: true, friends: [] })
          .mockResolvedValue({ ok: true, friends: accept ? [friend] : [] }),
      });
      await open(service);
      await press(accept ? '山田太郎の申請を承認' : '山田太郎の申請を拒否');
      expect(service.resolveFriendRequest).toHaveBeenCalledWith(
        request.requestId,
        accept,
      );
      expect(await screen.findByText('受信した申請はありません')).toBeTruthy();
      if (accept) expect(screen.getByText('佐藤花子')).toBeTruthy();
      else expect(screen.getByText('まだフレンドはいません')).toBeTruthy();
    },
  );

  test('処理済み申請のエラーを表示し、一覧を取り直す', async () => {
    await open(
      createService({
        listReceivedFriendRequests: jest
          .fn()
          .mockResolvedValueOnce({ ok: true, requests: [request] })
          .mockResolvedValue({ ok: true, requests: [] }),
        resolveFriendRequest: jest.fn().mockResolvedValue({
          ok: false,
          error: {
            type: 'request-not-pending',
            message: 'このフレンド申請はすでに処理されています。',
          },
        }),
      }),
    );
    await press('山田太郎の申請を承認');
    expect(
      await screen.findByText('このフレンド申請はすでに処理されています。'),
    ).toBeTruthy();
    expect(await screen.findByText('受信した申請はありません')).toBeTruthy();
  });

  test('フレンドの表示名だけを表示し、確認後に解除する', async () => {
    const service = createService({
      listFriends: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, friends: [friend] })
        .mockResolvedValue({ ok: true, friends: [] }),
    });
    await open(service);
    expect(screen.getByText('佐藤花子')).toBeTruthy();
    expect(screen.queryByText(friend.relationshipId)).toBeNull();
    expect(screen.queryByText(request.requestId)).toBeNull();
    await press('佐藤花子とのフレンドを解除');
    expect(service.removeFriend).not.toHaveBeenCalled();
    await press('キャンセル');
    expect(service.removeFriend).not.toHaveBeenCalled();
    await press('佐藤花子とのフレンドを解除');
    await press('解除する');
    expect(service.removeFriend).toHaveBeenCalledWith(friend.relationshipId);
    expect(await screen.findByText('まだフレンドはいません')).toBeTruthy();
  });

  test('解除失敗は確認画面に表示し、成功扱いしない', async () => {
    await open(
      createService({
        listFriends: jest
          .fn()
          .mockResolvedValue({ ok: true, friends: [friend] }),
        removeFriend: jest.fn().mockResolvedValue(network),
      }),
    );
    await press('佐藤花子とのフレンドを解除');
    await press('解除する');
    expect(await screen.findByText(network.error.message)).toBeTruthy();
    expect(screen.getByRole('button', { name: '解除する' })).toBeTruthy();
    expect(screen.queryByText('フレンドを解除しました。')).toBeNull();
  });

  test('一覧取得の失敗を空一覧として扱わず再読み込みできる', async () => {
    await open(
      createService({
        listFriends: jest
          .fn()
          .mockResolvedValueOnce(network)
          .mockResolvedValue({ ok: true, friends: [friend] }),
      }),
    );
    expect(screen.getByText(network.error.message)).toBeTruthy();
    expect(screen.queryByText('まだフレンドはいません')).toBeNull();
    await press('再読み込み');
    expect(await screen.findByText('佐藤花子')).toBeTruthy();
    expect(screen.queryByText(network.error.message)).toBeNull();
  });

  test('申請送信中の多重送信と入力変更を防止する', async () => {
    const pending =
      deferred<Awaited<ReturnType<FriendService['createFriendRequest']>>>();
    const service = createService({
      createFriendRequest: jest.fn(() => pending.promise),
    });
    await open(service);
    await preview();
    await press('申請を送る');
    expect(screen.getByLabelText('相手のフレンドコード').props.editable).toBe(
      false,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '申請を送る', disabled: true }),
    );
    expect(service.createFriendRequest).toHaveBeenCalledTimes(1);
    await act(async () =>
      pending.resolve({ ok: true, requestId: request.requestId }),
    );
    expect(await screen.findByText('フレンド申請を送りました。')).toBeTruthy();
  });

  test('画面へ戻ると再取得し、前回の遅い結果を混在させない', async () => {
    const pending =
      deferred<Awaited<ReturnType<FriendService['listFriends']>>>();
    const service = createService({
      listFriends: jest
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValue({ ok: true, friends: [friend] }),
    });
    const view = await render(
      <FriendsScreen friendService={service} isFocused />,
    );
    expect(screen.getByLabelText('フレンド情報を読み込み中')).toBeTruthy();
    await view.rerender(
      <FriendsScreen friendService={service} isFocused={false} />,
    );
    await view.rerender(<FriendsScreen friendService={service} isFocused />);
    expect(await screen.findByText('佐藤花子')).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, friends: [] }));
    expect(screen.getByText('佐藤花子')).toBeTruthy();
    expect(screen.queryByText('まだフレンドはいません')).toBeNull();
  });

  test('別画面で申請が完了してから戻っても操作不能にならない', async () => {
    const pending =
      deferred<Awaited<ReturnType<FriendService['createFriendRequest']>>>();
    const service = createService({
      createFriendRequest: jest.fn(() => pending.promise),
    });
    const view = await open(service);
    await preview();
    await press('申請を送る');
    await view.rerender(
      <FriendsScreen friendService={service} isFocused={false} />,
    );
    await act(async () =>
      pending.resolve({ ok: true, requestId: request.requestId }),
    );
    await view.rerender(<FriendsScreen friendService={service} isFocused />);
    await screen.findByText(code);
    expect(
      screen.getByRole('button', { name: '再読み込み', disabled: false }),
    ).toBeTruthy();
    expect(screen.queryByText('フレンド申請を送りました。')).toBeNull();
  });

  test('受信申請の処理中は承認・拒否の二重操作を防ぐ', async () => {
    const pending =
      deferred<Awaited<ReturnType<FriendService['resolveFriendRequest']>>>();
    const service = createService({
      listReceivedFriendRequests: jest
        .fn()
        .mockResolvedValue({ ok: true, requests: [request] }),
      resolveFriendRequest: jest.fn(() => pending.promise),
    });
    await open(service);
    await press('山田太郎の申請を承認');
    await fireEvent.press(
      screen.getByRole('button', {
        name: '山田太郎の申請を拒否',
        disabled: true,
      }),
    );
    expect(service.resolveFriendRequest).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: true, status: 'accepted' }));
  });

  test('再生成がタイムアウトしたら旧コードをコピーさせず、再取得で確認する', async () => {
    const service = createService({
      regenerateMyFriendCode: jest.fn().mockResolvedValue(network),
      getMyFriendCode: jest
        .fn()
        .mockResolvedValueOnce({ ok: true, code })
        .mockResolvedValue({ ok: true, code: otherCode }),
    });
    await open(service);
    await press('コードを再生成');
    await press('再生成する');
    expect(await screen.findByText(network.error.message)).toBeTruthy();
    await press('キャンセル');
    expect(screen.queryByText(code)).toBeNull();
    expect(
      screen.getByRole('button', {
        name: '自分のコードをコピー',
        disabled: true,
      }),
    ).toBeTruthy();
    await press('再読み込み');
    expect(await screen.findByText(otherCode)).toBeTruthy();
  });

  test('受信一覧の読み込み失敗でもフレンド一覧を表示し、受信の空状態は出さない', async () => {
    await open(
      createService({
        listReceivedFriendRequests: jest.fn().mockResolvedValue(network),
        listFriends: jest
          .fn()
          .mockResolvedValue({ ok: true, friends: [friend] }),
      }),
    );
    expect(screen.getByText('佐藤花子')).toBeTruthy();
    expect(screen.getByText(network.error.message)).toBeTruthy();
    expect(screen.queryByText('受信した申請はありません')).toBeNull();
  });
});
