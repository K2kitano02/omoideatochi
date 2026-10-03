import { useCallback, useEffect, useRef, useState } from 'react';

import {
  normalizeFriendCode,
  type Friend,
  type FriendCodeResult,
  type FriendFailure,
  type FriendRequest,
  type FriendService,
  type FriendUser,
} from './friendService';

export type FriendConfirmation =
  { type: 'regenerate' } | { type: 'remove'; friend: Friend };
type MutationResult =
  FriendCodeResult | { ok: true } | { ok: false; error: FriendFailure };
type ListState = {
  received: FriendRequest[];
  sent: FriendRequest[];
  friends: Friend[];
  errors: Partial<Record<'code' | 'received' | 'sent' | 'friends', string>>;
};
const emptyLists: ListState = {
  received: [],
  sent: [],
  friends: [],
  errors: {},
};

export const useFriendsScreen = (
  service: FriendService,
  copyText: (text: string) => Promise<boolean>,
) => {
  const [code, setCode] = useState<string>();
  const [lists, setLists] = useState(emptyLists);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<{ code: string; user: FriendUser }>();
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmation, setConfirmation] = useState<FriendConfirmation>();
  const [confirmationError, setConfirmationError] = useState<string>();
  const active = useRef(false);
  const epoch = useRef(0);
  const loadVersion = useRef(0);
  const previewVersion = useRef(0);
  const locked = useRef(false);

  const readLists = useCallback(
    (includeCode = true) =>
      Promise.all([
        includeCode ? service.getMyFriendCode() : undefined,
        service.listReceivedFriendRequests(),
        service.listSentFriendRequests(),
        service.listFriends(),
      ]),
    [service],
  );

  const applyLists = useCallback(
    (
      [codeResult, received, sent, friends]: Awaited<
        ReturnType<typeof readLists>
      >,
      currentEpoch: number,
      version: number,
    ) => {
      if (
        !active.current ||
        epoch.current !== currentEpoch ||
        loadVersion.current !== version
      )
        return;
      if (codeResult) setCode(codeResult.ok ? codeResult.code : undefined);
      setLists({
        received: received.ok ? received.requests : [],
        sent: sent.ok ? sent.requests : [],
        friends: friends.ok ? friends.friends : [],
        errors: {
          code:
            codeResult && !codeResult.ok ? codeResult.error.message : undefined,
          received: !received.ok ? received.error.message : undefined,
          sent: !sent.ok ? sent.error.message : undefined,
          friends: !friends.ok ? friends.error.message : undefined,
        },
      });
      setLoading(false);
    },
    [],
  );

  const load = async (includeCode = true) => {
    const version = ++loadVersion.current;
    const currentEpoch = epoch.current;
    const results = await readLists(includeCode);
    applyLists(results, currentEpoch, version);
  };

  const invalidate = useCallback(() => {
    epoch.current += 1;
    loadVersion.current += 1;
    previewVersion.current += 1;
  }, []);

  useEffect(() => {
    active.current = true;
    invalidate();
    const version = ++loadVersion.current;
    const currentEpoch = epoch.current;
    void readLists().then((results) =>
      applyLists(results, currentEpoch, version),
    );
    return () => {
      active.current = false;
      invalidate();
    };
  }, [applyLists, invalidate, readLists]);

  const reload = async (includeCode = true) => {
    setLoading(true);
    setLists(emptyLists);
    await load(includeCode);
  };

  const changeInput = (value: string) => {
    if (locked.current) return;
    ++previewVersion.current;
    setInput(value);
    setPreview(undefined);
    setChecking(false);
    setFeedback(undefined);
    setError(undefined);
  };

  const checkCode = async () => {
    if (!active.current || locked.current || loading || checking) return;
    const candidate = normalizeFriendCode(input);
    setPreview(undefined);
    setFeedback(undefined);
    setError(undefined);
    if (!/^[0-9A-F]{16}$/.test(candidate)) {
      setError(
        'フレンドコードは16文字の半角英数字（0〜9、A〜F）で入力してください。',
      );
      return;
    }
    const version = ++previewVersion.current;
    const currentEpoch = epoch.current;
    setChecking(true);
    const result = await service.previewFriendCode(candidate);
    if (
      !active.current ||
      epoch.current !== currentEpoch ||
      previewVersion.current !== version
    )
      return;
    setChecking(false);
    if (result.ok) setPreview({ code: candidate, user: result.user });
    else setError(result.error.message);
  };

  const mutate = async (
    operation: () => Promise<MutationResult>,
    message: string,
    inModal = false,
    regenerate = false,
  ) => {
    if (!active.current || locked.current || loading || checking) return;
    locked.current = true;
    ++loadVersion.current;
    const currentEpoch = epoch.current;
    setBusy(true);
    setFeedback(undefined);
    setError(undefined);
    setConfirmationError(undefined);
    try {
      const result = await operation();
      if (!active.current || epoch.current !== currentEpoch) return;
      if (result.ok) {
        if ('code' in result) setCode(result.code);
        setConfirmation(undefined);
        setPreview(undefined);
        setInput('');
        setFeedback(message);
        await reload(false);
      } else {
        if (regenerate) setCode(undefined);
        if (inModal) setConfirmationError(result.error.message);
        else setError(result.error.message);
        if (
          [
            'request-not-pending',
            'already-friends',
            'request-already-pending',
            'permission-denied',
          ].includes(result.error.type)
        ) {
          setPreview(undefined);
          await reload(false);
        }
      }
    } finally {
      locked.current = false;
      if (active.current) {
        setBusy(false);
      }
    }
  };

  const copyCode = async () => {
    if (!code || !active.current || locked.current || loading || checking)
      return;
    locked.current = true;
    setBusy(true);
    setFeedback(undefined);
    setError(undefined);
    const currentEpoch = epoch.current;
    try {
      const copied = await copyText(code);
      if (!active.current || epoch.current !== currentEpoch) return;
      if (copied) setFeedback('コードをコピーしました。');
      else setError('コピーできませんでした。再度お試しください。');
    } catch {
      if (active.current && epoch.current === currentEpoch)
        setError('コピーできませんでした。再度お試しください。');
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  };

  const openConfirmation = (action: FriendConfirmation) => {
    if (locked.current || loading || checking) return;
    setConfirmationError(undefined);
    setConfirmation(action);
  };
  const cancelConfirmation = () => {
    if (locked.current) return;
    setConfirmation(undefined);
    setConfirmationError(undefined);
  };
  const confirm = () => {
    if (!confirmation) return;
    return confirmation.type === 'regenerate'
      ? mutate(
          () => service.regenerateMyFriendCode(),
          'コードを再生成しました。新しいコードを共有してください。',
          true,
          true,
        )
      : mutate(
          () => service.removeFriend(confirmation.friend.relationshipId),
          'フレンドを解除しました。',
          true,
        );
  };

  return {
    code,
    lists,
    loading,
    busy,
    input,
    preview,
    checking,
    feedback,
    error,
    confirmation,
    confirmationError,
    disabled: busy || loading || checking,
    changeInput,
    checkCode,
    copyCode,
    openConfirmation,
    cancelConfirmation,
    confirm,
    refresh: () => {
      if (!locked.current && !checking) {
        setError(undefined);
        setFeedback(undefined);
        setPreview(undefined);
        void reload();
      }
    },
    sendRequest: () => {
      if (preview && normalizeFriendCode(input) === preview.code)
        return mutate(
          () => service.createFriendRequest(preview.code),
          'フレンド申請を送りました。',
        );
    },
    resolveRequest: (requestId: string, accept: boolean) =>
      mutate(
        () => service.resolveFriendRequest(requestId, accept),
        accept
          ? 'フレンド申請を承認しました。'
          : 'フレンド申請を拒否しました。',
      ),
  };
};
