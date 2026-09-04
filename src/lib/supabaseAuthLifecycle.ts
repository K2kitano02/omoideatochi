import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

type AuthAutoRefresh = {
  startAutoRefresh: () => unknown;
  stopAutoRefresh: () => unknown;
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

  const updateAutoRefresh = (state: AppStateStatus) => {
    if (state === 'active') {
      auth.startAutoRefresh();
      return;
    }

    auth.stopAutoRefresh();
  };

  return {
    start: () => {
      if (subscription) {
        return;
      }

      updateAutoRefresh(appState.currentState);
      subscription = appState.addEventListener('change', updateAutoRefresh);
    },
    stop: () => {
      if (!subscription) {
        return;
      }

      subscription.remove();
      subscription = undefined;
      auth.stopAutoRefresh();
    },
  };
};
