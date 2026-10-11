import type { MemoryMapPost } from './memoryTypes';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
export type MemoryMapMarker = {
  key: string;
  kind: MemoryMapPost['kind'];
  groupId: string | null;
  latitude: number;
  longitude: number;
  count: number;
  postIds: string[];
};

const wrapLongitude = (value: number) =>
  ((((value + 180) % 360) + 360) % 360) - 180;
const single = (post: MemoryMapPost): MemoryMapMarker => ({
  key: `post:${post.id}`,
  kind: post.kind,
  groupId: post.groupId,
  latitude: post.latitude,
  longitude: post.longitude,
  count: 1,
  postIds: [post.id],
});

// 表示上のグリッドだけで集約する。保存した投稿や座標は変更しない。
// Web Mercatorの世界座標を画面幅・表示経度幅に換算し、種類別に分ける。
export const clusterMemoryMapPosts = (
  posts: readonly MemoryMapPost[],
  region: MapRegion,
  width: number,
): MemoryMapMarker[] => {
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(region.longitudeDelta) ||
    region.longitudeDelta <= 0 ||
    !Number.isFinite(region.longitude)
  )
    return posts.map(single);
  const worldSize = (width * 360) / region.longitudeDelta;
  if (!Number.isFinite(worldSize) || worldSize >= 256 * 2 ** 20)
    return posts.map(single);
  const buckets = new Map<string, MemoryMapPost[]>();
  for (const post of posts) {
    const x =
      ((wrapLongitude(post.longitude - region.longitude) + 180) / 360) *
      worldSize;
    const sine = Math.sin(
      (Math.max(-85.05112878, Math.min(85.05112878, post.latitude)) * Math.PI) /
        180,
    );
    const y =
      (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize;
    const key = `${post.kind}:${post.groupId ?? 'self'}:${Math.round(x / 48)}:${Math.round(y / 48)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(post);
    else buckets.set(key, [post]);
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    if (bucket.length === 1) return single(bucket[0]);
    const first = bucket[0];
    return {
      key,
      kind: first.kind,
      groupId: first.groupId,
      count: bucket.length,
      postIds: bucket.map((post) => post.id),
      latitude:
        bucket.reduce((sum, post) => sum + post.latitude, 0) / bucket.length,
      longitude: wrapLongitude(
        first.longitude +
          bucket.reduce(
            (sum, post) =>
              sum + wrapLongitude(post.longitude - first.longitude),
            0,
          ) /
            bucket.length,
      ),
    };
  });
};
