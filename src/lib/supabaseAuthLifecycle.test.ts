import type { AppStateStatus } from 'react-native';

import { createSupabaseAuthLifecycle } from './supabaseAuthLifecycle';

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
  test('開始時にアプリが前面ならトークンの自動更新を始める', () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );

    lifecycle.start();

    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(dependencies.appState.addEventListener).toHaveBeenCalledTimes(1);
  });

  test.each<AppStateStatus>(['background', 'inactive'])(
    'アプリが%sになるとトークンの自動更新を止める',
    (state) => {
      const dependencies = createDependencies('active');
      const lifecycle = createSupabaseAuthLifecycle(
        dependencies.auth,
        dependencies.appState,
      );
      lifecycle.start();

      dependencies.changeState(state);

      expect(dependencies.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    },
  );

  test('背景から前面へ戻るとトークンの自動更新を再開する', () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    lifecycle.start();
    dependencies.changeState('background');

    dependencies.changeState('active');

    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  });

  test('複数回開始してもAppStateリスナーを重複登録しない', () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );

    lifecycle.start();
    lifecycle.start();

    expect(dependencies.appState.addEventListener).toHaveBeenCalledTimes(1);
    expect(dependencies.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
  });

  test('終了時にリスナーを解除してトークンの自動更新を止める', () => {
    const dependencies = createDependencies('active');
    const lifecycle = createSupabaseAuthLifecycle(
      dependencies.auth,
      dependencies.appState,
    );
    lifecycle.start();

    lifecycle.stop();

    expect(dependencies.remove).toHaveBeenCalledTimes(1);
    expect(dependencies.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
