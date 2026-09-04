import type { AppStateStatus } from 'react-native';

import {
  createSupabaseAuthLifecycle,
  disposeSupabaseAuthLifecycle,
  initializeSupabaseAuthLifecycle,
} from './supabaseAuthLifecycle';

const createDependencies = (currentState: AppStateStatus = 'active') => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  const appState = {
    currentState,
    addEventListener: jest.fn(
      (_event: 'change', nextListener: (state: AppStateStatus) => void) => {
        listener = nextListener;
        return { remove };
      },
    ),
  };
  const auth = {
    initialize: jest.fn().mockResolvedValue({ error: null }),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };

  return {
    appState,
    auth,
    remove,
    changeState: (state: AppStateStatus) => listener?.(state),
  };
};

describe('createSupabaseAuthLifecycle', () => {
  afterEach(async () => {
    await disposeSupabaseAuthLifecycle();
  });

  test('開始時にアプリが前面ならトークンの自動更新を始める', async () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );

    await lifecycle.start();

    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(dependencies.appState.addEventListener).toHaveBeenCalledTimes(1);
  });

  test.each<AppStateStatus>(['background', 'inactive'])(
    'アプリが%sになるとトークンの自動更新を止める',
    async (state) => {
      const dependencies = createDependencies('active');
      const lifecycle = createSupabaseAuthLifecycle(
        dependencies.auth,
        dependencies.appState,
      );
      await lifecycle.start();

      dependencies.changeState(state);

      expect(dependencies.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    },
  );

  test('背景から前面へ戻るとトークンの自動更新を再開する', async () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    await lifecycle.start();
    dependencies.changeState('background');

    dependencies.changeState('active');

    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  });

  test('複数回開始してもAppStateリスナーを重複登録しない', async () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );

    await Promise.all([lifecycle.start(), lifecycle.start()]);

    expect(dependencies.appState.addEventListener).toHaveBeenCalledTimes(1);
    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
  });

  test('終了時にリスナーを解除してトークンの自動更新を止める', async () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    await lifecycle.start();

    await lifecycle.stop();

    expect(dependencies.remove).toHaveBeenCalledTimes(1);
    expect(dependencies.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  test('Supabase内部の初期化後にもバックグラウンドなら自動更新を止める', async () => {
    let resolveInitialization: (() => void) | undefined;
    let isAutoRefreshRunning = false;
    const initialization = new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    });
    const dependencies = createDependencies('background');
    dependencies.auth.startAutoRefresh.mockImplementation(() => {
      isAutoRefreshRunning = true;
    });
    dependencies.auth.stopAutoRefresh.mockImplementation(() => {
      isAutoRefreshRunning = false;
    });
    dependencies.auth.initialize.mockImplementation(async () => {
      await initialization;
      dependencies.auth.startAutoRefresh();
      return { error: null };
    });
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );

    const startPromise = lifecycle.start();
    resolveInitialization?.();
    await startPromise;

    expect(isAutoRefreshRunning).toBe(false);
  });

  test('共有ライフサイクルを複数回初期化してもリスナーは1件だけになる', async () => {
    const dependencies = createDependencies('active');

    const firstLifecycle = initializeSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    const secondLifecycle = initializeSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    await firstLifecycle.start();

    expect(secondLifecycle).toBe(firstLifecycle);
    expect(dependencies.appState.addEventListener).toHaveBeenCalledTimes(1);
  });

  test('共有ライフサイクルの破棄でリスナーを解除する', async () => {
    const dependencies = createDependencies('active');
    initializeSupabaseAuthLifecycle(dependencies.auth, dependencies.appState);

    await disposeSupabaseAuthLifecycle();

    expect(dependencies.remove).toHaveBeenCalledTimes(1);
  });
});
