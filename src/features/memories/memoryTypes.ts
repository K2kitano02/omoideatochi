export type MemoryCursor = { createdAt: string; id: string };
export type MemoryPageOptions = {
  limit?: number;
  cursor?: MemoryCursor | null;
};
export type NormalizedMemoryPageOptions = {
  limit: number;
  cursor: MemoryCursor | null;
};
export type MemoryPage<T> = { posts: T[]; nextCursor: MemoryCursor | null };

type Destination =
  { kind: 'personal'; groupId: null } | { kind: 'group'; groupId: string };
type MapFields = {
  id: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};
export type MemoryMapPost = MapFields & Destination;
type PostFields = MapFields & {
  authorId: string;
  authorDisplayName: string | null;
  photoId: string;
  capturedAt: string;
  memo: string | null;
};
export type MemoryPost = PostFields &
  (
    | { kind: 'personal'; groupId: null; discoveryRadiusM: 0 | 500 | 1000 }
    | { kind: 'group'; groupId: string; discoveryRadiusM: null }
  );
export type MemoryFailure = {
  type:
    | 'unauthenticated'
    | 'permission-denied'
    | 'not-found'
    | 'invalid-argument'
    | 'network'
    | 'invalid-response'
    | 'unexpected'
    | 'stale';
  message: string;
};
export type MemoryReadResult<T> =
  { ok: true; data: T } | { ok: false; error: MemoryFailure };

const messages: Record<MemoryFailure['type'], string> = {
  unauthenticated: 'ログインが必要です。再度ログインしてください。',
  'permission-denied': 'この投稿情報を表示する権限がありません。',
  'not-found':
    'この投稿を表示できません。削除されたか、閲覧できない可能性があります。',
  'invalid-argument': '取得条件が正しくありません。',
  network: '通信に失敗しました。接続を確認して再度お試しください。',
  'invalid-response':
    '投稿情報を読み込めませんでした。時間をおいて再度お試しください。',
  unexpected: '投稿情報の取得に失敗しました。時間をおいて再度お試しください。',
  stale: 'この取得結果は無効になりました。',
};
export const memoryFailure = (
  type: MemoryFailure['type'],
): { ok: false; error: MemoryFailure } => ({
  ok: false,
  error: { type, message: messages[type] },
});
export const isMemoryRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isMemoryUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Preserve PostgreSQL microseconds; Date alone truncates the last three digits.
export const getMemoryTimestampMicros = (value: unknown): bigint | null => {
  if (typeof value !== 'string') return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (match[8] !== 'Z' && (Number(match[10]) > 23 || Number(match[11]) > 59))
  )
    return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const fraction = (match[7] ?? '').padEnd(6, '0');
  return BigInt(millis) * BigInt(1000) + BigInt(fraction.slice(3));
};

const nullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const coordinate = (value: unknown, bound: number): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= bound;

export const parseMemoryMapPost = (value: unknown): MemoryMapPost | null => {
  if (
    !isMemoryRecord(value) ||
    !isMemoryUuid(value.post_id) ||
    !coordinate(value.latitude, 90) ||
    !coordinate(value.longitude, 180) ||
    getMemoryTimestampMicros(value.created_at) === null
  )
    return null;
  const base = {
    id: value.post_id.toLowerCase(),
    latitude: value.latitude,
    longitude: value.longitude,
    createdAt: value.created_at as string,
  };
  if (value.kind === 'personal' && value.group_id === null)
    return { ...base, kind: 'personal', groupId: null };
  if (value.kind === 'group' && isMemoryUuid(value.group_id))
    return { ...base, kind: 'group', groupId: value.group_id.toLowerCase() };
  return null;
};

export const parseMemoryPost = (value: unknown): MemoryPost | null => {
  const map = parseMemoryMapPost(value);
  if (
    !map ||
    !isMemoryRecord(value) ||
    !isMemoryUuid(value.author_id) ||
    !isMemoryUuid(value.photo_id) ||
    !nullableString(value.author_display_name) ||
    !nullableString(value.memo) ||
    getMemoryTimestampMicros(value.captured_at) === null
  )
    return null;
  const base = {
    ...map,
    authorId: value.author_id.toLowerCase(),
    authorDisplayName: value.author_display_name,
    photoId: value.photo_id.toLowerCase(),
    capturedAt: value.captured_at as string,
    memo: value.memo,
  };
  if (map.kind === 'group' && value.discovery_radius_m === null)
    return {
      ...base,
      kind: 'group',
      groupId: map.groupId,
      discoveryRadiusM: null,
    };
  if (
    map.kind === 'personal' &&
    (value.discovery_radius_m === 0 ||
      value.discovery_radius_m === 500 ||
      value.discovery_radius_m === 1000)
  )
    return {
      ...base,
      kind: 'personal',
      groupId: null,
      discoveryRadiusM: value.discovery_radius_m,
    };
  return null;
};

export const parseMemoryPageOptions = (
  value: unknown,
): NormalizedMemoryPageOptions | null => {
  if (value === undefined) return { limit: 50, cursor: null };
  if (!isMemoryRecord(value)) return null;
  const limit = value.limit === undefined ? 50 : value.limit;
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200
  )
    return null;
  const cursor = value.cursor;
  if (cursor === undefined || cursor === null) return { limit, cursor: null };
  if (
    !isMemoryRecord(cursor) ||
    !isMemoryUuid(cursor.id) ||
    getMemoryTimestampMicros(cursor.createdAt) === null
  )
    return null;
  return {
    limit,
    cursor: {
      id: cursor.id.toLowerCase(),
      createdAt: cursor.createdAt as string,
    },
  };
};

export const normalizeMemoryGroupIds = (value: unknown): string[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const ids: unknown[] = Array.from(value);
  if (!ids.every(isMemoryUuid)) return null;
  return [...new Set(ids.map((id) => id.toLowerCase()))];
};
