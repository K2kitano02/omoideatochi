import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group, GroupService } from '../groups/groupService';
import type { MemoryReader } from './memoryService';
import {
  memoryFailure,
  type MemoryCursor,
  type MemoryMapPost,
} from './memoryTypes';

type MapReader = Pick<MemoryReader, 'listMapPosts' | 'invalidate' | 'dispose'>;
export const useMemoryMap = ({
  isFocused,
  groupService,
  memoryService,
}: {
  isFocused: boolean;
  groupService: Pick<GroupService, 'listGroups'>;
  memoryService: { createReadScope: () => MapReader };
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<MemoryMapPost[]>([]);
  const [nextCursor, setNextCursor] = useState<MemoryCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [wasFocused, setWasFocused] = useState(isFocused);
  // フォーカスが変わる描画で古い投稿を先に消す。取得開始を待って再表示しない。
  if (wasFocused !== isFocused) {
    setWasFocused(isFocused);
    setPosts([]);
    setNextCursor(null);
    setLoading(true);
    setLoadingGroups(true);
    setLoadingMore(false);
    setError(null);
    setMoreError(null);
  }
  const selected = useRef<string[]>([]);
  const reader = useRef<MapReader | null>(null);
  const generation = useRef(0);
  const busyMore = useRef(false);
  const checkingGroups = useRef(true);

  const begin = useCallback(() => {
    const version = ++generation.current;
    reader.current?.invalidate();
    setPosts([]);
    setNextCursor(null);
    setError(null);
    setMoreError(null);
    setLoading(true);
    setLoadingMore(false);
    busyMore.current = false;
    return version;
  }, []);

  const read = useCallback(
    async (ids: string[], version: number, cursor?: MemoryCursor) => {
      const current = reader.current;
      if (!current) return;
      const result = await current.listMapPosts(
        ids,
        cursor ? { cursor } : undefined,
      );
      if (version !== generation.current || current !== reader.current) return;
      setLoading(false);
      setLoadingMore(false);
      busyMore.current = false;
      if (!result.ok) {
        if (cursor && result.error.type === 'network')
          setMoreError(result.error.message);
        else {
          setPosts([]);
          setNextCursor(null);
          setError(
            result.error.type === 'stale'
              ? '情報が更新されました。投稿を再取得してください。'
              : result.error.message,
          );
        }
        return;
      }
      setPosts((previous) =>
        cursor
          ? [
              ...previous,
              ...result.data.posts.filter(
                (post) => !previous.some((old) => old.id === post.id),
              ),
            ]
          : result.data.posts,
      );
      setNextCursor(result.data.nextCursor);
    },
    [],
  );

  const loadGroupsAndPosts = useCallback(
    async (version: number) => {
      try {
        const result = await groupService.listGroups();
        if (version !== generation.current || !reader.current) return;
        checkingGroups.current = false;
        setLoadingGroups(false);
        if (!result.ok) {
          setGroups([]);
          selected.current = [];
          setSelectedGroupIds([]);
          setLoading(false);
          setError(result.error.message);
          return;
        }
        setGroups(result.groups);
        const ids = selected.current.filter((id) =>
          result.groups.some((group) => group.id === id),
        );
        selected.current = ids;
        setSelectedGroupIds(ids);
        await read(ids, version);
      } catch {
        if (version === generation.current && reader.current) {
          checkingGroups.current = false;
          setLoadingGroups(false);
          setLoading(false);
          setError(memoryFailure('unexpected').error.message);
        }
      }
    },
    [groupService, read],
  );

  const refresh = useCallback(async () => {
    if (!reader.current) return;
    checkingGroups.current = true;
    setLoadingGroups(true);
    await loadGroupsAndPosts(begin());
  }, [begin, loadGroupsAndPosts]);

  useEffect(() => {
    if (!isFocused) return;
    const scope = memoryService.createReadScope();
    checkingGroups.current = true;
    reader.current = scope;
    void loadGroupsAndPosts(++generation.current);
    return () => {
      generation.current += 1;
      reader.current = null;
      scope.dispose();
      busyMore.current = false;
    };
  }, [isFocused, memoryService, loadGroupsAndPosts]);

  const toggleGroup = useCallback(
    (id: string) => {
      if (
        checkingGroups.current ||
        !reader.current ||
        !groups.some((group) => group.id === id)
      )
        return;
      const ids = selected.current.includes(id)
        ? selected.current.filter((item) => item !== id)
        : [...selected.current, id].sort();
      selected.current = ids;
      setSelectedGroupIds(ids);
      const version = begin();
      void read(ids, version);
    },
    [begin, groups, read],
  );

  const loadMore = useCallback(async () => {
    if (!reader.current || loading || busyMore.current || !nextCursor) return;
    busyMore.current = true;
    setLoadingMore(true);
    setMoreError(null);
    const version = ++generation.current;
    await read(selected.current, version, nextCursor);
  }, [loading, nextCursor, read]);

  return {
    groups,
    selectedGroupIds,
    posts,
    nextCursor,
    loading,
    loadingGroups,
    loadingMore,
    error,
    moreError,
    refresh,
    toggleGroup,
    loadMore,
  };
};
