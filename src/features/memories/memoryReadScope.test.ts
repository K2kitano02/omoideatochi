import { createMemoryReadScope } from './memoryReadScope';
import type { MemoryReadResult } from './memoryTypes';

const deferred = () => {
  let resolve!: (value: MemoryReadResult<string>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<MemoryReadResult<string>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const success = (data: string): MemoryReadResult<string> => ({
  ok: true,
  data,
});
const stale = {
  ok: false,
  error: { type: 'stale', message: 'この取得結果は無効になりました。' },
};

test('最新要求だけ成功し旧成功を捨てる', async () => {
  const scope = createMemoryReadScope();
  const delay = deferred();
  const old = scope.run(() => delay.promise);
  expect(await scope.run(async () => success('B'))).toEqual({
    ok: true,
    data: 'B',
  });
  delay.resolve(success('A'));
  expect(await old).toEqual(stale);
});
test('Aへ戻った後も最初のAは無効', async () => {
  const scope = createMemoryReadScope();
  const delay = deferred();
  const old = scope.run(() => delay.promise);
  await scope.run(async () => success('B'));
  expect(await scope.run(async () => success('A-new'))).toEqual(
    success('A-new'),
  );
  delay.resolve(success('A-old'));
  expect(await old).toEqual(stale);
});
test.each(['permission', 'reject', 'success'])(
  'invalidate後の旧%sを捨てる',
  async (kind) => {
    const scope = createMemoryReadScope();
    const delay = deferred();
    const old = scope.run(() => delay.promise);
    scope.invalidate();
    scope.invalidate();
    if (kind === 'reject') delay.reject(new Error('test-only-secret'));
    else if (kind === 'permission')
      delay.resolve({
        ok: false,
        error: {
          type: 'permission-denied',
          message: 'old-error',
        },
      });
    else delay.resolve(success('old'));
    expect(await old).toEqual(stale);
    expect(await scope.run(async () => success('fresh'))).toEqual(
      success('fresh'),
    );
  },
);
test('disposeは古い要求を捨て、今後の処理も実行しない', async () => {
  const scope = createMemoryReadScope();
  const delay = deferred();
  const old = scope.run(() => delay.promise);
  scope.dispose();
  scope.dispose();
  scope.invalidate();
  delay.resolve(success('old'));
  expect(await old).toEqual(stale);
  let calls = 0;
  expect(
    await scope.run(async () => {
      calls += 1;
      return success('new');
    }),
  ).toEqual(stale);
  expect(calls).toBe(0);
});
test('別scopeの要求は互いを無効化しない', async () => {
  const first = createMemoryReadScope();
  const second = createMemoryReadScope();
  const delay = deferred();
  const pending = first.run(() => delay.promise);
  expect(await second.run(async () => success('B'))).toEqual(success('B'));
  delay.resolve(success('A'));
  expect(await pending).toEqual(success('A'));
});
test.each(['sync', 'async'])(
  '現在の%s例外は内部本文を公開しない',
  async (kind) => {
    const scope = createMemoryReadScope();
    const result = await scope.run(() => {
      if (kind === 'sync') throw new Error('test-only-secret');
      return Promise.reject(new Error('test-only-secret'));
    });
    expect(result).toEqual({
      ok: false,
      error: {
        type: 'unexpected',
        message:
          '投稿情報の取得に失敗しました。時間をおいて再度お試しください。',
      },
    });
  },
);
