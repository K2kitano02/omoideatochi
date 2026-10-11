import {
  CaptureError,
  validateCaptureLocation,
  type CaptureLocation,
} from './captureSession';
export function waitForCaptureLocation({
  capturedAt,
  now,
  signal,
  watch,
}: {
  capturedAt: number;
  now: () => number;
  signal: AbortSignal;
  watch: (
    callback: (value: CaptureLocation) => void,
    onError: () => void,
  ) => Promise<{ remove: () => void }>;
}): Promise<CaptureLocation> {
  return new Promise((resolve, reject) => {
    let ended = false;
    let subscription: { remove: () => void } | undefined;
    const stop = () => {
      ended = true;
      subscription?.remove();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      stop();
      reject(new CaptureError('cancelled', '撮影を終了しました。'));
    };
    const failed = () => {
      stop();
      reject(
        new CaptureError(
          'location',
          '位置情報を取得できませんでした。端末の位置情報設定を確認してください。',
        ),
      );
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, { once: true });
    watch((value) => {
      if (ended) return;
      let position: CaptureLocation;
      try {
        position = validateCaptureLocation(value, capturedAt, now());
      } catch {
        return;
      }
      stop();
      resolve(position);
    }, failed)
      .then((value) => {
        if (ended) value.remove();
        else subscription = value;
      })
      .catch(failed);
  });
}
