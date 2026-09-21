import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';

import { getGroupInvitationService } from './groupInvitations';
import type { GroupInvitationService } from './groupInvitationService';

type PendingCountService = Pick<
  GroupInvitationService,
  'listOwnedGroupPendingCounts'
>;

type AppStateSource = {
  addEventListener: (
    event: 'change',
    listener: (state: AppStateStatus) => void,
  ) => NativeEventSubscription;
};

type UseOwnedGroupPendingCountsOptions = {
  appState?: AppStateSource;
  service?: PendingCountService;
};

export const useOwnedGroupPendingCounts = ({
  appState = AppState,
  service: providedService,
}: UseOwnedGroupPendingCountsOptions = {}) => {
  const service = useMemo(
    () => providedService ?? getGroupInvitationService(),
    [providedService],
  );
  const [countsByGroup, setCountsByGroup] = useState<
    Readonly<Record<string, number>>
  >({});
  const [error, setError] = useState<string>();
  const mountedRef = useRef(true);
  const latestLoadRef = useRef(0);

  const refresh = useCallback(async () => {
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;
    const result = await service.listOwnedGroupPendingCounts();

    if (!mountedRef.current || latestLoadRef.current !== loadId) {
      return;
    }

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setCountsByGroup(
      Object.fromEntries(
        result.counts.map((count) => [count.groupId, count.pendingCount]),
      ),
    );
    setError(undefined);
  }, [service]);

  useEffect(() => {
    mountedRef.current = true;
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;
    void service.listOwnedGroupPendingCounts().then((result) => {
      if (!mountedRef.current || latestLoadRef.current !== loadId) {
        return;
      }

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setCountsByGroup(
        Object.fromEntries(
          result.counts.map((count) => [count.groupId, count.pendingCount]),
        ),
      );
      setError(undefined);
    });
    const subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      mountedRef.current = false;
      latestLoadRef.current += 1;
      subscription.remove();
    };
  }, [appState, refresh, service]);

  const totalCount = useMemo(
    () =>
      Object.values(countsByGroup).reduce(
        (total, pendingCount) => total + pendingCount,
        0,
      ),
    [countsByGroup],
  );

  return { countsByGroup, error, refresh, totalCount };
};
