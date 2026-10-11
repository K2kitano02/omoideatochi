import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppState, View, type AppStateStatus } from 'react-native';
import { forwardRef, StrictMode, useImperativeHandle } from 'react';
import { PermissionStatus } from 'expo';
import type { CameraView, CameraViewProps } from 'expo-camera';
import type { NativeCaptureRuntime } from '../features/capture/nativeCapture';
import { CaptureScreen } from './CaptureScreen';

const allowed = {
  granted: true,
  canAskAgain: true,
  status: PermissionStatus.GRANTED,
  expires: 'never' as const,
};
const denied = { ...allowed, granted: false, status: PermissionStatus.DENIED };
const at = 100000;
const CameraDouble = forwardRef<CameraView, CameraViewProps>((props, ref) => {
  useImperativeHandle(ref, () => ({}) as CameraView);
  return <View {...props} />;
});
CameraDouble.displayName = 'CameraDouble';
const setup = () => {
  const files = new Set<string>();
  const runtime: NativeCaptureRuntime = {
    CameraView: CameraDouble as unknown as typeof CameraView,
    initialize: async () => {},
    now: () => at,
    getPermissions: jest.fn(async () => ({
      camera: allowed,
      location: allowed,
    })),
    requestPermissions: jest.fn(async () => ({
      camera: allowed,
      location: allowed,
    })),
    takePhoto: async () => {
      files.add('file:///raw.jpg');
      return { uri: 'file:///raw.jpg', width: 1000, height: 1000 };
    },
    prepare: async () => {
      files.add('file:///ready.jpg');
      return {
        uri: 'file:///ready.jpg',
        width: 1000,
        height: 1000,
        size: 1000,
      };
    },
    remove: async (uri) => {
      files.delete(uri);
    },
    locate: async () => ({
      latitude: 35,
      longitude: 139,
      accuracy: 10,
      timestamp: at,
    }),
  };
  return { runtime, files };
};
const take = async () => {
  const camera = await screen.findByLabelText('撮影プレビュー');
  await fireEvent(camera, 'cameraReady');
  await fireEvent.press(screen.getByRole('button', { name: '撮影する' }));
};
it('撮影後は写真と2択だけを表示し、撮り直しで一時写真を消す', async () => {
  const { runtime, files } = setup();
  await render(<CaptureScreen runtime={runtime} onClose={() => {}} />);
  await take();
  expect(await screen.findByLabelText('撮影した写真')).toBeOnTheScreen();
  expect(screen.queryByRole('header')).toBeNull();
  expect(screen.queryByText(/位置を取得しました|一時的に保持/)).toBeNull();
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled();
  expect(screen.getByLabelText('撮影した写真')).toHaveStyle({ flex: 1 });
  expect([...files]).toEqual(['file:///ready.jpg']);
  await fireEvent.press(screen.getByRole('button', { name: '撮り直す' }));
  expect(await screen.findByLabelText('撮影プレビュー')).toBeOnTheScreen();
  expect([...files]).toEqual([]);
});
it('権限拒否時は撮影せず、再要求と設定変更の導線を表示する', async () => {
  const { runtime } = setup();
  jest
    .mocked(runtime.getPermissions)
    .mockResolvedValue({ camera: denied, location: denied });
  await render(<CaptureScreen runtime={runtime} onClose={() => {}} />);
  expect(
    await screen.findByRole('button', { name: 'カメラと位置情報を許可' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: '端末の設定を開く' }),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText('撮影プレビュー')).toBeNull();
  expect(
    screen.getByLabelText('撮影の許可案内').props.contentContainerStyle,
  ).toEqual(
    expect.objectContaining({ flexGrow: 1, justifyContent: 'flex-end' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'カメラと位置情報を許可' }),
  );
  expect(await screen.findByLabelText('撮影プレビュー')).toBeOnTheScreen();
});
it('未実装の投稿ボタンでは写真を消さず画面を閉じない', async () => {
  const { runtime, files } = setup();
  let closed = false;
  const view = await render(
    <CaptureScreen
      runtime={runtime}
      onClose={() => {
        closed = true;
      }}
    />,
  );
  await take();
  await screen.findByLabelText('撮影した写真');
  await fireEvent.press(screen.getByRole('button', { name: '投稿する' }));
  expect(closed).toBe(false);
  expect([...files]).toEqual(['file:///ready.jpg']);
  expect(screen.getByLabelText('撮影した写真')).toBeOnTheScreen();
  await view.unmount();
  await waitFor(() => expect([...files]).toEqual([]));
});
it('撮影前はヘッダーを表示せずキャンセルで閉じられる', async () => {
  const { runtime } = setup();
  let closed = false;
  await render(
    <CaptureScreen
      runtime={runtime}
      onClose={() => {
        closed = true;
      }}
    />,
  );
  await screen.findByLabelText('撮影プレビュー');
  expect(screen.queryByRole('header')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  expect(closed).toBe(true);
});
it('位置取得に失敗した写真を確認画面へ進めず、撮り直せる', async () => {
  const { runtime, files } = setup();
  runtime.locate = async () => {
    throw new Error('private internal error');
  };
  await render(<CaptureScreen runtime={runtime} onClose={() => {}} />);
  await take();
  expect(await screen.findByRole('alert')).toHaveTextContent(/撮影|位置/);
  expect(screen.queryByText(/private internal/)).toBeNull();
  expect(screen.queryByLabelText('撮影した写真')).toBeNull();
  expect([...files]).toEqual([]);
});
it('アンマウント時に確認中の写真を削除する（タブ移動・ログアウト）', async () => {
  const { runtime, files } = setup();
  const view = await render(
    <CaptureScreen runtime={runtime} onClose={() => {}} />,
  );
  await take();
  await screen.findByLabelText('撮影した写真');
  await view.unmount();
  await waitFor(() => expect([...files]).toEqual([]));
});
it('古い開発ビルドでは再ビルドの案内だけを表示する', async () => {
  await render(<CaptureScreen runtime={null} onClose={() => {}} />);
  expect(screen.getByText(/開発ビルドを作り直してください/)).toBeOnTheScreen();
  expect(screen.queryByLabelText('撮影プレビュー')).toBeNull();
});
it('背景へ移動したら撮影プレビューを停止し確認中の写真を破棄する', async () => {
  const { runtime, files } = setup();
  let change!: (state: AppStateStatus) => void;
  const originalSubscribe = AppState.addEventListener;
  AppState.addEventListener = jest.fn((_event, callback) => {
    change = callback;
    return { remove: () => {} };
  });
  let closed = false;
  try {
    await render(
      <CaptureScreen
        runtime={runtime}
        onClose={() => {
          closed = true;
        }}
      />,
    );
    await take();
    await screen.findByLabelText('撮影した写真');
    await act(async () => {
      change('background');
    });
    expect(closed).toBe(true);
    expect([...files]).toEqual([]);
    expect(screen.queryByLabelText('撮影プレビュー')).toBeNull();
  } finally {
    AppState.addEventListener = originalSubscribe;
  }
});
it('権限確認中のキャンセル後に撮影を開始しない', async () => {
  const { runtime, files } = setup();
  let resolve!: (
    value: Awaited<ReturnType<NativeCaptureRuntime['getPermissions']>>,
  ) => void;
  let checking!: () => void;
  const started = new Promise<void>((done) => {
    checking = done;
  });
  const pending = new Promise<
    Awaited<ReturnType<NativeCaptureRuntime['getPermissions']>>
  >((done) => {
    resolve = done;
  });
  jest
    .mocked(runtime.getPermissions)
    .mockImplementationOnce(async () => ({
      camera: allowed,
      location: allowed,
    }))
    .mockImplementationOnce(() => {
      checking();
      return pending;
    });
  await render(<CaptureScreen runtime={runtime} onClose={() => {}} />);
  await take();
  await started;
  await fireEvent.press(screen.getByRole('button', { name: 'キャンセル' }));
  await act(async () => {
    resolve({ camera: allowed, location: allowed });
  });
  expect([...files]).toEqual([]);
  expect(screen.queryByLabelText('撮影した写真')).toBeNull();
});
it('StrictModeで初期処理を再実行しても権限確認が止まらない', async () => {
  const { runtime } = setup();
  await render(
    <StrictMode>
      <CaptureScreen runtime={runtime} onClose={() => {}} />
    </StrictMode>,
  );
  expect(await screen.findByLabelText('撮影プレビュー')).toBeOnTheScreen();
});
