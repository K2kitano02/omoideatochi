import { clusterMemoryMapPosts } from './memoryMapClusters';
import type { MemoryMapPost } from './memoryTypes';

const personal = (id: string, longitude = 0): MemoryMapPost => ({
  id,
  kind: 'personal',
  groupId: null,
  latitude: 0,
  longitude,
  createdAt: '2026-10-10T00:00:00Z',
});
const region = {
  latitude: 0,
  longitude: 0,
  latitudeDelta: 1,
  longitudeDelta: 1,
};

test('縮小時は近い本人投稿をまとめ、拡大時は個別の投稿に戻る', () => {
  const posts = [personal('a'), personal('b', 0.0005)];
  const wide = clusterMemoryMapPosts(posts, region, 400);
  expect(wide).toHaveLength(1);
  expect(wide[0].postIds).toEqual(['a', 'b']);
  expect(wide[0].count).toBe(2);
  expect(
    clusterMemoryMapPosts(posts, { ...region, longitudeDelta: 0.001 }, 400),
  ).toHaveLength(2);
  expect(posts).toHaveLength(2);
});

test('同じ地点でも本人と異なるグループを同じ集約に混ぜない', () => {
  const posts: MemoryMapPost[] = [
    personal('a'),
    { ...personal('b'), kind: 'group', groupId: 'group-a' },
    { ...personal('c'), kind: 'group', groupId: 'group-b' },
  ];
  const result = clusterMemoryMapPosts(posts, region, 400);
  expect(result.map((item) => [item.kind, item.groupId, item.count])).toEqual([
    ['personal', null, 1],
    ['group', 'group-a', 1],
    ['group', 'group-b', 1],
  ]);
});

test('日付変更線付近でも集約の中心を反対側へ移さない', () => {
  const result = clusterMemoryMapPosts(
    [personal('a', 179.999), personal('b', -179.999)],
    { ...region, longitude: 180 },
    400,
  );
  expect(result).toHaveLength(1);
  expect(Math.abs(result[0].longitude)).toBeCloseTo(180);
});

test('最大拡大付近では完全に同じ座標の投稿も別マーカーになる', () => {
  const result = clusterMemoryMapPosts(
    [personal('a'), personal('b')],
    { ...region, longitudeDelta: 0.0001 },
    400,
  );
  expect(result.map((item) => item.count)).toEqual([1, 1]);
});

test('レイアウト前や不正な表示範囲では集約せず、空一覧も扱える', () => {
  expect(clusterMemoryMapPosts([], region, 400)).toEqual([]);
  expect(
    clusterMemoryMapPosts([personal('a'), personal('b')], region, 0),
  ).toHaveLength(2);
  expect(
    clusterMemoryMapPosts(
      [personal('a'), personal('b')],
      { ...region, longitudeDelta: 0 },
      400,
    ),
  ).toHaveLength(2);
});
