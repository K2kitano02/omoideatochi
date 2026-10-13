import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { NativeCaptureRuntime } from './nativeCapture';

export function getCaptureRuntime(): NativeCaptureRuntime | undefined {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return undefined;
  if (
    !['ExpoCamera', 'ExpoLocation', 'ExpoImageManipulator', 'FileSystem'].every(
      (name) => requireOptionalNativeModule(name),
    )
  )
    return undefined;
  // An old development build must show an upgrade notice, not import missing modules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Guard native imports before loading the capture runtime.
  return require('./nativeCapture').nativeCaptureRuntime;
}

export async function initializeCaptureCache(): Promise<void> {
  await getCaptureRuntime()?.initialize();
}
