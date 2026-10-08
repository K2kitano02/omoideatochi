import {
  normalizeMemoryGroupIds,
  parseMemoryMapPost,
  parseMemoryPageOptions,
  parseMemoryPost,
} from './memoryTypes';

const ID = '33000000-0000-0000-0000-000000000001';
const USER = '33000000-0000-0000-0000-000000000002';
const PHOTO = '33000000-0000-0000-0000-000000000003';
const GROUP = '33000000-0000-0000-0000-00000000000a';
const TIME = '2026-10-08T01:02:03.123456+00:00';
const row = {
  post_id: ID,
  author_id: USER,
  author_display_name: null,
  kind: 'personal',
  group_id: null,
  photo_id: PHOTO,
  latitude: 0,
  longitude: 1,
  captured_at: TIME,
  memo: null,
  discovery_radius_m: 0,
  created_at: TIME,
};

test('個人投稿の固定項目だけを変換し、小数秒を保持する', () => {
  expect(
    parseMemoryPost({
      ...row,
      object_key: 'test-only/private',
      signed_url: 'test-only',
    }),
  ).toEqual({
    id: ID,
    authorId: USER,
    authorDisplayName: null,
    kind: 'personal',
    groupId: null,
    photoId: PHOTO,
    latitude: 0,
    longitude: 1,
    capturedAt: TIME,
    memo: null,
    discoveryRadiusM: 0,
    createdAt: TIME,
  });
});
test.each([0, 500, 1000])('個人の範囲%dを受け付ける', (radius) => {
  expect(
    parseMemoryPost({ ...row, discovery_radius_m: radius })?.discoveryRadiusM,
  ).toBe(radius);
});
test('グループ投稿とNULLの範囲を変換する', () => {
  expect(
    parseMemoryPost({
      ...row,
      kind: 'group',
      group_id: GROUP,
      discovery_radius_m: null,
      author_display_name: '山田太郎',
      memo: 'テストメモ',
    }),
  ).toMatchObject({
    kind: 'group',
    groupId: GROUP,
    discoveryRadiusM: null,
    authorDisplayName: '山田太郎',
    memo: 'テストメモ',
  });
});
test.each([
  { latitude: NaN },
  { longitude: Infinity },
  { latitude: '0' },
  { latitude: 91 },
  { latitude: -91 },
  { longitude: 181 },
  { longitude: -181 },
  { post_id: 'invalid' },
  { author_id: null },
  { photo_id: undefined },
  { kind: 'other' },
  { group_id: GROUP },
  { discovery_radius_m: null },
  { discovery_radius_m: 150 },
  { kind: 'group', discovery_radius_m: null },
  { kind: 'group', group_id: GROUP },
  { memo: 1 },
  { author_display_name: false },
  { captured_at: null },
  { created_at: '2026-02-30T00:00:00Z' },
  { created_at: '2026-10-08T25:00:00Z' },
  { created_at: '2026-10-08T01:02:03' },
  { created_at: 'not-a-date' },
])('不正な投稿項目%jを拒否する', (change) => {
  expect(parseMemoryPost({ ...row, ...change })).toBeNull();
});
test.each([null, [], {}, 'post'])('投稿行でない%jを拒否する', (value) => {
  expect(parseMemoryPost(value)).toBeNull();
});
test('座標境界と閏年を受け付ける', () => {
  expect(
    parseMemoryPost({
      ...row,
      latitude: -90,
      longitude: 180,
      created_at: '2024-02-29T23:59:59.999999-01:00',
    }),
  ).not.toBeNull();
});
test('地図は最小6項目だけ返す', () => {
  expect(parseMemoryMapPost(row)).toEqual({
    id: ID,
    kind: 'personal',
    groupId: null,
    latitude: 0,
    longitude: 1,
    createdAt: TIME,
  });
  expect(
    parseMemoryMapPost({ ...row, kind: 'group', group_id: GROUP }),
  ).toMatchObject({ groupId: GROUP });
});
test.each([
  { group_id: GROUP },
  { kind: 'group' },
  { longitude: Infinity },
  { created_at: null },
])('地図の不整合%jを拒否する', (change) => {
  expect(parseMemoryMapPost({ ...row, ...change })).toBeNull();
});
test('未指定のページ条件は50件・初回になる', () => {
  expect(parseMemoryPageOptions(undefined)).toEqual({
    limit: 50,
    cursor: null,
  });
  expect(parseMemoryPageOptions({ cursor: null })).toEqual({
    limit: 50,
    cursor: null,
  });
});
test.each([1, 200])('件数境界%dを受け付ける', (limit) => {
  expect(parseMemoryPageOptions({ limit })).toEqual({ limit, cursor: null });
});
test.each([null, 0, -1, 201, 1.5, NaN, Infinity, '50'])(
  '不正な件数%jを拒否する',
  (limit) => {
    expect(parseMemoryPageOptions({ limit })).toBeNull();
  },
);
test.each([
  null,
  [],
  1,
  { cursor: {} },
  { cursor: { id: ID } },
  { cursor: { createdAt: TIME } },
  { cursor: { id: 'bad', createdAt: TIME } },
  { cursor: { id: ID, createdAt: 'bad' } },
])('不正ページ条件%jを拒否する', (value) => {
  expect(parseMemoryPageOptions(value)).toBeNull();
});
test('カーソルをコピーして精度を保持する', () => {
  const cursor = { id: ID, createdAt: TIME };
  const parsed = parseMemoryPageOptions({ cursor });
  cursor.createdAt = 'changed';
  expect(parsed).toEqual({ limit: 50, cursor: { id: ID, createdAt: TIME } });
});
test('グループ選択を正規化・重複除去・コピーする', () => {
  const ids = [GROUP.toUpperCase(), GROUP];
  const parsed = normalizeMemoryGroupIds(ids);
  ids[0] = 'changed';
  expect(parsed).toEqual([GROUP]);
  expect(normalizeMemoryGroupIds(undefined)).toEqual([]);
  expect(normalizeMemoryGroupIds([])).toEqual([]);
});
test.each([null, GROUP, [null], [[GROUP]], ['bad']])(
  '不正な選択%jを拒否する',
  (value) => {
    expect(normalizeMemoryGroupIds(value)).toBeNull();
  },
);

test('空き要素のあるグループ配列も不正入力として拒否する', () => {
  expect(normalizeMemoryGroupIds(new Array(1))).toBeNull();
});
