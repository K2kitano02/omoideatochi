import { Camera, CameraView } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import {
  CaptureError,
  type CapturePhoto,
  type RawPhoto,
} from './captureSession';
import { waitForCaptureLocation } from './captureLocation';

const directory = new Directory(Paths.cache, 'memory-capture-v1');
let nextFile = 0;
let initialized = false;
const initialize = async () => {
  if (initialized) return;
  // Only this feature's cache is cleared, never the application's cache root.
  if (directory.exists) directory.delete();
  directory.create({ intermediates: true, idempotent: true });
  initialized = true;
};
const adopt = async (uri: string) => {
  if (!uri.startsWith(Paths.cache.uri))
    throw new CaptureError('photo', '写真の保存先を確認できませんでした。');
  const file = new File(uri);
  directory.create({ intermediates: true, idempotent: true });
  await file.move(
    new File(directory, `capture-${Date.now()}-${nextFile++}.jpg`),
  );
  return file;
};
const getPermissions = async () => {
  const [camera, location] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
  ]);
  return { camera, location };
};
const requestPermissions = async () => {
  let { camera, location } = await getPermissions();
  if (!camera.granted && camera.canAskAgain)
    camera = await Camera.requestCameraPermissionsAsync();
  if (!location.granted && location.canAskAgain)
    location = await Location.requestForegroundPermissionsAsync();
  return { camera, location };
};
const remove = async (uri: string) => {
  if (
    !uri.startsWith(
      directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`,
    )
  ) {
    throw new CaptureError(
      'cleanup',
      '一時写真の保存先を確認できませんでした。',
    );
  }
  const file = new File(uri);
  if (file.exists) file.delete();
};
const prepare = async (photo: RawPhoto): Promise<CapturePhoto> => {
  const context = ImageManipulator.manipulate(photo.uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let temporary: string | undefined;
  try {
    if (Math.max(photo.width, photo.height) > 2048)
      context.resize(
        photo.width >= photo.height ? { width: 2048 } : { height: 2048 },
      );
    image = await context.renderAsync();
    // Encode pixels into a new JPEG. No source EXIF/metadata is copied.
    const result = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.8,
      base64: false,
    });
    temporary = result.uri;
    const file = await adopt(result.uri);
    temporary = file.uri;
    const prepared = {
      uri: file.uri,
      width: result.width,
      height: result.height,
      size: file.size,
    };
    temporary = undefined;
    return prepared;
  } finally {
    image?.release();
    context.release();
    if (temporary) {
      const file = new File(temporary);
      if (file.exists) file.delete();
    }
  }
};
const takePhoto = async (camera: CameraView): Promise<RawPhoto> => {
  const result = await camera.takePictureAsync({
    quality: 1,
    exif: false,
    base64: false,
    skipProcessing: false,
    shutterSound: true,
  });
  try {
    const file = await adopt(result.uri);
    return { uri: file.uri, width: result.width, height: result.height };
  } catch (error) {
    const file = new File(result.uri);
    if (file.exists) file.delete();
    throw error;
  }
};
export const nativeCaptureRuntime = {
  CameraView,
  initialize,
  getPermissions,
  requestPermissions,
  prepare,
  remove,
  takePhoto,
  now: () => Date.now(),
  locate: (capturedAt: number, signal: AbortSignal) =>
    waitForCaptureLocation({
      capturedAt,
      signal,
      now: () => Date.now(),
      watch: (update, onError) =>
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 0,
            mayShowUserSettingsDialog: true,
          },
          (position) =>
            update({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
            }),
          onError,
        ),
    }),
};
export type NativeCaptureRuntime = typeof nativeCaptureRuntime;
