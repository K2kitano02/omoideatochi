import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

type AuthAutoRefresh = {
  initialize: () => Promise<unknown>;
  startAutoRefresh: () => Promise<unknown> | unknown;
  stopAutoRefresh: () => Promise<unknown> | unknown;
};

type AppStateSource = {
  currentState: AppStateStatus;
  addEventListener: (
    event: 'change',
    listener: (state: AppStateStatus) => void,
  ) => NativeEventSubscription;
};

export const createSupabaseAuthLifecycle = (
  auth: AuthAutoRefresh,
  appState: AppStateSource = AppState,
) => {
  let subscription: NativeEventSubscription | undefined;
  let startPromise: Promise<void> | undefined;

  const updateAutoRefresh = async (state: AppStateStatus) => {
    if (state === 'active') {
      await auth.startAutoRefresh();
      return;
    }

    await auth.stopAutoRefresh();
  };

  return {
    start: () => {
      if (startPromise) {
        return startPromise;
      }

      subscription = appState.addEventListener('change', (state) => {
        void updateAutoRefresh(state);
      });
      startPromise = (async () => {
        await auth.initialize();
        await updateAutoRefresh(appState.currentState);
      })();

      return startPromise;
    },
    stop: async () => {
      if (!subscription) {
        return;
      }

      await startPromise;
      subscription.remove();
      subscription = undefined;
      startPromise = undefined;
      await auth.stopAutoRefresh();
    },
  };
};

type SupabaseAuthLifecycle = ReturnType<typeof createSupabaseAuthLifecycle>;

let sharedLifecycle: SupabaseAuthLifecycle | undefined;

export const initializeSupabaseAuthLifecycle = (
  auth: AuthAutoRefresh,
  appState: AppStateSource = AppState,
): SupabaseAuthLifecycle => {
  sharedLifecycle ??= createSupabaseAuthLifecycle(auth, appState);
  void sharedLifecycle.start();

  return sharedLifecycle;
};

export const disposeSupabaseAuthLifecycle = async (): Promise<void> => {
  const lifecycle = sharedLifecycle;
  sharedLifecycle = undefined;
  await lifecycle?.stop();
};
