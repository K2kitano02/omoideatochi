export type CaptureLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};
export type RawPhoto = { uri: string; width: number; height: number };
export type CapturePhoto = RawPhoto & { size: number };
export type CapturedMemory = {
  photo: CapturePhoto;
  location: CaptureLocation;
  capturedAt: number;
};
export class CaptureError extends Error {
  constructor(
    public readonly code: 'location' | 'photo' | 'cancelled' | 'cleanup',
    message: string,
  ) {
    super(message);
    this.name = 'CaptureError';
  }
}
const locationError = () =>
  new CaptureError(
    'location',
    '撮影時の正確な位置を取得できませんでした。位置情報の設定を確認し、撮り直してください。',
  );
export function validateCaptureLocation(
  value: CaptureLocation,
  at: number,
  now: number,
): CaptureLocation {
  if (
    !Number.isFinite(at) ||
    !Number.isFinite(now) ||
    !Number.isFinite(value.latitude) ||
    Math.abs(value.latitude) > 90 ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.longitude) > 180 ||
    value.accuracy === null ||
    !Number.isFinite(value.accuracy) ||
    value.accuracy < 0 ||
    value.accuracy > 50 ||
    !Number.isFinite(value.timestamp) ||
    value.timestamp > now ||
    Math.abs(value.timestamp - at) > 10000
  )
    throw locationError();
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: value.accuracy,
    timestamp: value.timestamp,
  };
}
export function validateCapturePhoto(value: CapturePhoto): CapturePhoto {
  if (
    !value.uri.startsWith('file://') ||
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    value.width <= 0 ||
    value.height <= 0 ||
    Math.max(value.width, value.height) > 2048 ||
    !Number.isInteger(value.size) ||
    value.size <= 0 ||
    value.size > 5 * 1024 * 1024
  ) {
    throw new CaptureError(
      'photo',
      '写真を準備できませんでした。5MB以内の写真になるよう撮り直してください。',
    );
  }
  return {
    uri: value.uri,
    width: value.width,
    height: value.height,
    size: value.size,
  };
}
type Dependencies = {
  now: () => number;
  locate: (at: number, signal: AbortSignal) => Promise<CaptureLocation>;
  prepare: (photo: RawPhoto) => Promise<CapturePhoto>;
  remove: (uri: string) => Promise<void>;
};
export function createCaptureSession(deps: Dependencies) {
  let closed = false;
  let generation = 0;
  let controller: AbortController | undefined;
  const ownedFiles = new Set<string>();
  const remove = async (uri: string) => {
    try {
      await deps.remove(uri);
      ownedFiles.delete(uri);
    } catch {
      throw new CaptureError(
        'cleanup',
        '一時写真を削除できませんでした。アプリを再起動してから撮影してください。',
      );
    }
  };
  const clear = async () => {
    await Promise.all([...ownedFiles].map(remove));
  };
  const reset = async () => {
    generation += 1;
    controller?.abort();
    await clear();
  };
  const capture = async (
    take: () => Promise<RawPhoto>,
  ): Promise<CapturedMemory> => {
    if (closed) throw new CaptureError('cancelled', '撮影を終了しました。');
    const id = ++generation;
    controller?.abort();
    await clear();
    if (closed || generation !== id)
      throw new CaptureError('cancelled', '撮影を終了しました。');
    const attemptFiles = new Set<string>();
    const active = () => !closed && generation === id;
    const abort = new AbortController();
    controller = abort;
    const capturedAt = deps.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    const location = new Promise<CaptureLocation>((resolve, reject) => {
      onAbort = () =>
        reject(new CaptureError('cancelled', '撮影を終了しました。'));
      abort.signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => reject(locationError()), 20000);
      // Invoke after wiring cancellation. No last-known-location fallback.
      Promise.resolve()
        .then(() => deps.locate(capturedAt, abort.signal))
        .then((value) => {
          resolve(validateCaptureLocation(value, capturedAt, deps.now()));
        })
        .catch(reject);
    });
    const picture = (async () => {
      const raw = await take();
      ownedFiles.add(raw.uri);
      attemptFiles.add(raw.uri);
      if (!active()) {
        await remove(raw.uri);
        throw new CaptureError('cancelled', '撮影を終了しました。');
      }
      let prepared: CapturePhoto | undefined;
      try {
        prepared = await deps.prepare(raw);
        ownedFiles.add(prepared.uri);
        attemptFiles.add(prepared.uri);
        if (!active()) {
          await remove(prepared.uri);
          throw new CaptureError('cancelled', '撮影を終了しました。');
        }
        return validateCapturePhoto(prepared);
      } catch (error) {
        if (prepared) await remove(prepared.uri);
        throw error;
      } finally {
        await remove(raw.uri);
      }
    })();
    try {
      const [photo, position] = await Promise.all([picture, location]);
      if (!active())
        throw new CaptureError('cancelled', '撮影を終了しました。');
      return { photo, location: position, capturedAt };
    } catch (error) {
      if (generation === id) generation += 1;
      abort.abort();
      // A native photo operation cannot be forcibly cancelled. Its late file
      // is removed by the generation checks instead of becoming a draft.
      // Report failures promptly even if the native operation is stalled.
      // Its late outputs still pass through active() and owned-file cleanup.
      void picture.catch(() => undefined);
      // Never clean a later capture's files when an old native task finishes.
      await Promise.all([...attemptFiles].map(remove));
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      abort.signal.removeEventListener('abort', onAbort);
      abort.abort();
    }
  };
  return {
    capture,
    reset,
    dispose: async () => {
      closed = true;
      await reset();
    },
  };
}
