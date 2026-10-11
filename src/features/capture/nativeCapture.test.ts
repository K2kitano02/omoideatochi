import { nativeCaptureRuntime } from './nativeCapture';
import type { CameraView } from 'expo-camera';

const mockFiles = new Map<string, number>();
const cache = 'file:///cache/';
const mockSave = jest.fn();
const mockResize = jest.fn();
let mockMoveFails = false;
jest.mock('expo-camera', () => ({ CameraView: () => null, Camera: {} }));
jest.mock('expo-location', () => ({}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: mockResize,
      release: () => {},
      renderAsync: async () => ({ release: () => {}, saveAsync: mockSave }),
    }),
  },
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(first: string | { uri: string }, name?: string) {
      this.uri = (typeof first === 'string' ? first : first.uri) + (name ?? '');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri) ?? 0;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    async move(target: File) {
      await Promise.resolve();
      if (mockMoveFails) throw new Error('test-only move failure');
      const size = this.size;
      this.delete();
      this.uri = target.uri;
      mockFiles.set(this.uri, size);
    }
  }
  class Directory {
    uri: string;
    constructor(_root: unknown, name: string) {
      this.uri = `file:///cache/${name}/`;
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {
      for (const uri of mockFiles.keys())
        if (uri.startsWith(this.uri)) mockFiles.delete(uri);
    }
  }
  return { Paths: { cache: { uri: 'file:///cache/' } }, File, Directory };
});

beforeEach(() => {
  mockMoveFails = false;
  mockFiles.clear();
  mockResize.mockClear();
  mockSave.mockReset().mockImplementation(async (options) => {
    if (
      options.format !== 'jpeg' ||
      options.compress !== 0.8 ||
      options.base64 !== false
    )
      throw new Error('bad encoding');
    mockFiles.set(`${cache}encoded.jpg`, 1000);
    return { uri: `${cache}encoded.jpg`, width: 2048, height: 1536 };
  });
});

it('写真をJPEGへ加工し長辺を縮小、加工後の写真だけ専用キャッシュへ移す', async () => {
  mockFiles.set(`${cache}raw.jpg`, 6000000);
  const result = await nativeCaptureRuntime.prepare({
    uri: `${cache}raw.jpg`,
    width: 4000,
    height: 3000,
  });
  expect(result).toMatchObject({ width: 2048, height: 1536, size: 1000 });
  expect(result.uri).toMatch(/^file:\/\/\/cache\/memory-capture-v1\//);
  expect(mockResize).toHaveBeenCalledWith({ width: 2048 });
  expect(mockFiles.has(`${cache}encoded.jpg`)).toBe(false);
  await nativeCaptureRuntime.remove(result.uri);
  expect(mockFiles.has(result.uri)).toBe(false);
});
it('他機能のキャッシュは削除対象にしない', async () => {
  mockFiles.set(`${cache}other.jpg`, 100);
  await expect(
    nativeCaptureRuntime.remove(`${cache}other.jpg`),
  ).rejects.toThrow();
  expect(mockFiles.has(`${cache}other.jpg`)).toBe(true);
});
it('小さい写真を拡大せず、縦写真は高さを制限する', async () => {
  mockFiles.set(`${cache}raw.jpg`, 100);
  await nativeCaptureRuntime.prepare({
    uri: `${cache}raw.jpg`,
    width: 1200,
    height: 1600,
  });
  expect(mockResize).not.toHaveBeenCalled();
  await nativeCaptureRuntime.prepare({
    uri: `${cache}raw.jpg`,
    width: 3000,
    height: 4000,
  });
  expect(mockResize).toHaveBeenCalledWith({ height: 2048 });
});
it('起動時に前回の一時写真を清掃し、他機能のファイルは保持する', async () => {
  mockFiles.set(`${cache}memory-capture-v1/orphan.jpg`, 1000);
  mockFiles.set(`${cache}other.jpg`, 1000);
  await nativeCaptureRuntime.initialize();
  expect([...mockFiles.keys()]).toEqual([`${cache}other.jpg`]);
  mockFiles.set(`${cache}memory-capture-v1/current.jpg`, 1000);
  await nativeCaptureRuntime.initialize();
  expect(mockFiles.has(`${cache}memory-capture-v1/current.jpg`)).toBe(true);
});
it('移動失敗時は写真を返さず、SDKが生成した一時ファイルも削除する', async () => {
  mockMoveFails = true;
  mockFiles.set(`${cache}raw.jpg`, 100);
  await expect(
    nativeCaptureRuntime.prepare({
      uri: `${cache}raw.jpg`,
      width: 100,
      height: 100,
    }),
  ).rejects.toThrow();
  expect(mockFiles.has(`${cache}encoded.jpg`)).toBe(false);
});
it('撮影結果の移動完了を待ち、EXIFと余分な結果を保持しない', async () => {
  mockFiles.set(`${cache}camera.jpg`, 100);
  const camera = {
    takePictureAsync: async (options: { exif: boolean; base64: boolean }) => {
      if (options.exif || options.base64)
        throw new Error('unexpected metadata');
      return {
        uri: `${cache}camera.jpg`,
        width: 100,
        height: 100,
        exif: { GPSLatitude: 'test-only' },
      };
    },
  } as unknown as CameraView;
  const result = await nativeCaptureRuntime.takePhoto(camera);
  expect(result.uri).toMatch(/^file:\/\/\/cache\/memory-capture-v1\//);
  expect(mockFiles.has(result.uri)).toBe(true);
  expect(mockFiles.has(`${cache}camera.jpg`)).toBe(false);
  expect(result).not.toHaveProperty('exif');
  await nativeCaptureRuntime.remove(result.uri);
  expect(mockFiles.has(result.uri)).toBe(false);
});
