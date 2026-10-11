import { waitForCaptureLocation } from './captureLocation';
import type { CaptureLocation } from './captureSession';

const good = { latitude: 35, longitude: 139, accuracy: 10, timestamp: 100000 };
it('古い位置と精度不足を捨て、新しい位置を受け取ると監視を解除する', async () => {
  let update!: (value: CaptureLocation) => void;
  let observing = false;
  const pending = waitForCaptureLocation({
    capturedAt: 100000,
    now: () => 100001,
    signal: new AbortController().signal,
    watch: async (callback) => {
      update = callback;
      observing = true;
      return {
        remove: () => {
          observing = false;
        },
      };
    },
  });
  await Promise.resolve();
  update({ ...good, timestamp: 50000 });
  update({ ...good, accuracy: 51 });
  expect(observing).toBe(true);
  update(good);
  expect(await pending).toEqual(good);
  expect(observing).toBe(false);
});
it('キャンセル後に監視登録が完了しても解除し、位置を採用しない', async () => {
  const abort = new AbortController();
  let finish!: (value: { remove: () => void }) => void;
  let observing = true;
  const pending = waitForCaptureLocation({
    capturedAt: 100000,
    now: () => 100000,
    signal: abort.signal,
    watch: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  }).catch(() => null);
  abort.abort();
  expect(await pending).toBeNull();
  finish({
    remove: () => {
      observing = false;
    },
  });
  await Promise.resolve();
  expect(observing).toBe(false);
});
it('登録前にキャンセルされた場合は監視を始めない', async () => {
  const abort = new AbortController();
  abort.abort();
  let observing = false;
  await expect(
    waitForCaptureLocation({
      capturedAt: 100000,
      now: () => 100000,
      signal: abort.signal,
      watch: async () => {
        observing = true;
        return { remove: () => {} };
      },
    }),
  ).rejects.toThrow();
  expect(observing).toBe(false);
});
