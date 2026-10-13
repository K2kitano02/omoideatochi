import {
  createCaptureSession,
  validateCaptureLocation,
  validateCapturePhoto,
} from './captureSession';

const at = 100000;
const location = {
  latitude: 35.681236,
  longitude: 139.767125,
  accuracy: 50,
  timestamp: at,
};
const photo = {
  uri: 'file:///capture/processed.jpg',
  width: 2048,
  height: 1536,
  size: 5 * 1024 * 1024,
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('撮影データの検証', () => {
  it('精度50m・撮影から10秒の境界を採用し、それを超える位置は拒否する', () => {
    expect(
      validateCaptureLocation({ ...location, timestamp: 90000 }, at, at),
    ).toEqual(locationWithTime(90000));
    expect(() =>
      validateCaptureLocation({ ...location, accuracy: 50.01 }, at, at),
    ).toThrow();
    expect(() =>
      validateCaptureLocation({ ...location, timestamp: 89999 }, at, at),
    ).toThrow();
    expect(() =>
      validateCaptureLocation({ ...location, timestamp: 110001 }, at, 120000),
    ).toThrow();
  });
  it.each([
    { ...location, accuracy: null },
    { ...location, accuracy: -1 },
    { ...location, latitude: NaN },
    { ...location, longitude: 181 },
    { ...location, timestamp: at + 1 },
  ])('不明・不正・未来の位置を拒否する %j', (value) => {
    expect(() => validateCaptureLocation(value, at, at)).toThrow();
  });
  it('JPEGサイズの境界を採用し、容量・解像度・空ファイルの異常を拒否する', () => {
    expect(validateCapturePhoto(photo)).toEqual(photo);
    for (const value of [
      { ...photo, size: photo.size + 1 },
      { ...photo, width: 2049 },
      { ...photo, size: 0 },
      { ...photo, height: NaN },
    ]) {
      expect(() => validateCapturePhoto(value)).toThrow();
    }
  });
});
const locationWithTime = (timestamp: number) => ({ ...location, timestamp });

describe('撮影セッション', () => {
  const setup = () => {
    const files = new Set<string>();
    const deps = {
      now: () => at,
      locate: jest.fn(async () => location),
      prepare: jest.fn(async () => {
        files.add(photo.uri);
        return photo;
      }),
      remove: jest.fn(async (uri: string) => {
        files.delete(uri);
      }),
    };
    const take = async () => {
      files.add('file:///capture/raw.jpg');
      return { uri: 'file:///capture/raw.jpg', width: 4000, height: 3000 };
    };
    return { files, deps, take, session: createCaptureSession(deps) };
  };
  it('同じ撮影の位置と加工写真を対応づけ、元写真を削除する', async () => {
    const { session, take, files } = setup();
    const result = await session.capture(take);
    expect(result).toEqual({ photo, location, capturedAt: at });
    expect([...files]).toEqual([photo.uri]);
    await session.reset();
    expect([...files]).toEqual([]);
  });
  it('精度不足で成功せず、撮影済みファイルを破棄する', async () => {
    const { session, deps, take, files } = setup();
    deps.locate.mockResolvedValue({ ...location, accuracy: 51 });
    await expect(session.capture(take)).rejects.toThrow();
    await session.dispose();
    expect([...files]).toEqual([]);
  });
  it('終了後に遅れて届いた写真を採用せず削除する', async () => {
    const { session, files } = setup();
    const late = deferred<{ uri: string; width: number; height: number }>();
    const started = deferred<void>();
    const pending = session
      .capture(() => {
        started.resolve();
        return late.promise;
      })
      .catch(() => null);
    await started.promise;
    await session.dispose();
    files.add('file:///capture/late.jpg');
    late.resolve({ uri: 'file:///capture/late.jpg', width: 100, height: 100 });
    expect(await pending).toBeNull();
    expect([...files]).toEqual([]);
    await expect(session.capture(async () => photo)).rejects.toThrow();
  });
  it('位置が20秒で取れなければ停止し写真を破棄する', async () => {
    jest.useFakeTimers();
    try {
      const { session, deps, take, files } = setup();
      deps.locate.mockImplementation(() => new Promise(() => {}));
      const pending = session
        .capture(take)
        .catch((error: Error) => error.message);
      await jest.advanceTimersByTimeAsync(20000);
      expect(await pending).toMatch(/位置/);
      await session.dispose();
      expect([...files]).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
  it('撮り直し後に前回の位置が届いても新しい撮影と混ぜない', async () => {
    const { session, deps, take } = setup();
    const late = deferred<typeof location>();
    const started = deferred<void>();
    deps.locate.mockImplementationOnce(() => {
      started.resolve();
      return late.promise;
    });
    const old = session.capture(take).catch(() => null);
    await started.promise;
    await session.reset();
    const current = await session.capture(take);
    late.resolve({ ...location, latitude: 0 });
    expect(await old).toBeNull();
    expect(current.location.latitude).toBe(35.681236);
    await session.dispose();
  });
  it('前回の加工が遅れて終了しても次の撮影の写真を削除しない', async () => {
    const { session, deps, files } = setup();
    const late = deferred<typeof photo>();
    const started = deferred<void>();
    deps.prepare.mockImplementationOnce(() => {
      started.resolve();
      return late.promise;
    });
    const old = session
      .capture(async () => ({
        uri: 'file:///capture/old-raw.jpg',
        width: 1000,
        height: 1000,
      }))
      .catch(() => null);
    await started.promise;
    await session.reset();
    const current = await session.capture(async () => ({
      uri: 'file:///capture/new-raw.jpg',
      width: 1000,
      height: 1000,
    }));
    files.add('file:///capture/old-ready.jpg');
    late.resolve({ ...photo, uri: 'file:///capture/old-ready.jpg' });
    expect(await old).toBeNull();
    expect(files.has(current.photo.uri)).toBe(true);
    expect(files.has('file:///capture/old-ready.jpg')).toBe(false);
    await session.dispose();
  });
  it('撮影準備の途中でキャンセルしたらカメラを開始しない', async () => {
    const { session } = setup();
    let started = false;
    const pending = session
      .capture(async () => {
        started = true;
        return photo;
      })
      .catch(() => null);
    await session.reset();
    expect(await pending).toBeNull();
    expect(started).toBe(false);
  });
  it('ネイティブ撮影が止まっていても20秒で位置取得失敗を返し、遅れた写真を清掃する', async () => {
    jest.useFakeTimers();
    try {
      const { session, deps, files } = setup();
      deps.locate.mockImplementation(() => new Promise(() => {}));
      const late = deferred<{ uri: string; width: number; height: number }>();
      let failure: string | undefined;
      const pending = session
        .capture(() => late.promise)
        .catch((error: Error) => {
          failure = error.message;
        });
      await jest.advanceTimersByTimeAsync(20000);
      expect(failure).toMatch(/位置/);
      files.add('file:///capture/late.jpg');
      late.resolve({
        uri: 'file:///capture/late.jpg',
        width: 100,
        height: 100,
      });
      await pending;
      await jest.advanceTimersByTimeAsync(0);
      expect([...files]).toEqual([]);
      await session.dispose();
    } finally {
      jest.useRealTimers();
    }
  });
});
