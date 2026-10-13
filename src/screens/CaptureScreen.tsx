import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CameraView } from 'expo-camera';
import {
  CaptureError,
  createCaptureSession,
  type CapturedMemory,
} from '../features/capture/captureSession';
import { getCaptureRuntime } from '../features/capture/captureRuntime';
import type { NativeCaptureRuntime } from '../features/capture/nativeCapture';

type Permissions = Awaited<ReturnType<NativeCaptureRuntime['getPermissions']>>;
export const CaptureScreen = ({
  onClose,
  runtime: supplied,
}: {
  onClose: () => void;
  runtime?: NativeCaptureRuntime | null;
}) => {
  const runtime = useMemo(
    () => (supplied === undefined ? getCaptureRuntime() : supplied),
    [supplied],
  );
  const camera = useRef<CameraView>(null);
  const session = useRef<ReturnType<typeof createCaptureSession> | null>(null);
  const live = useRef(false);
  const working = useRef(false);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const [permissions, setPermissions] = useState<Permissions>();
  const [draft, setDraft] = useState<CapturedMemory>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [stopped, setStopped] = useState(false);
  const allowed = permissions?.camera.granted && permissions.location.granted;

  const refreshPermissions = async (request: boolean) => {
    if (!runtime || working.current || closing.current) return;
    const owner = session.current;
    working.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await runtime.initialize();
      const value = await (request
        ? runtime.requestPermissions()
        : runtime.getPermissions());
      if (!live.current || session.current !== owner || closing.current) return;
      if (!value.camera.granted || !value.location.granted) {
        await session.current?.reset();
        setDraft(undefined);
        setReady(false);
      }
      if (live.current && session.current === owner && !closing.current)
        setPermissions(value);
    } catch {
      if (live.current && session.current === owner && !closing.current)
        setError(
          'カメラ・位置情報の準備に失敗しました。端末の設定を確認して再試行してください。',
        );
    } finally {
      if (session.current === owner) {
        working.current = false;
        if (live.current) setBusy(false);
      }
    }
  };

  const close = async () => {
    closing.current = true;
    setStopped(true);
    setReady(false);
    setDraft(undefined);
    try {
      await session.current?.reset();
      onCloseRef.current();
    } catch {
      if (live.current)
        setError(
          '一時写真を削除できませんでした。キャンセルを再試行するかアプリを再起動してください。',
        );
    }
  };

  useEffect(() => {
    live.current = true;
    working.current = false;
    const current = runtime ? createCaptureSession(runtime) : null;
    session.current = current;
    void Promise.resolve().then(() => {
      if (live.current && session.current === current)
        void refreshPermissions(false);
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        void close();
      } else if (state === 'active') {
        void refreshPermissions(false);
      }
    });
    return () => {
      live.current = false;
      subscription.remove();
      session.current = null;
      void current?.dispose().catch(() => {
        console.warn(
          '一時写真の清掃に失敗しました。次回起動時に再試行します。',
        );
      });
    };
    // Each mounted capture flow owns its session. Callbacks use refs and only
    // the runtime identity changes this ownership boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime]);

  const shoot = async () => {
    if (
      !session.current ||
      !camera.current ||
      !runtime ||
      !ready ||
      working.current ||
      stopped
    )
      return;
    const current = session.current;
    working.current = true;
    setBusy(true);
    setError(undefined);
    try {
      // Recheck permissions immediately before taking a new photo.
      const value = await runtime.getPermissions();
      if (!live.current || session.current !== current || closing.current)
        return;
      setPermissions(value);
      if (!value.camera.granted || !value.location.granted) {
        setReady(false);
        return;
      }
      const cameraView = camera.current;
      if (!cameraView) return;
      const result = await current.capture(() => runtime.takePhoto(cameraView));
      if (live.current && session.current === current && !closing.current) {
        setDraft(result);
        setReady(false);
      }
    } catch (cause) {
      if (
        live.current &&
        !(cause instanceof CaptureError && cause.code === 'cancelled')
      ) {
        setError(
          cause instanceof CaptureError
            ? cause.message
            : '撮影または位置情報の取得に失敗しました。端末の設定を確認し、撮り直してください。',
        );
      }
    } finally {
      working.current = false;
      if (live.current) setBusy(false);
    }
  };

  const retake = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await session.current?.reset();
      if (live.current) {
        setDraft(undefined);
        setReady(false);
      }
    } catch {
      if (live.current)
        setError(
          '一時写真を削除できませんでした。アプリを再起動してください。',
        );
    } finally {
      working.current = false;
      if (live.current) setBusy(false);
    }
  };
  const CameraComponent = runtime?.CameraView;
  return (
    <SafeAreaView style={styles.screen} accessibilityLabel="撮影画面">
      <View style={styles.content}>
        {!runtime ? (
          <Text style={styles.text}>
            撮影機能を使うには、iOS・Androidの開発ビルドを作り直してください。
          </Text>
        ) : stopped ? (
          <Text style={styles.text}>撮影を終了しています。</Text>
        ) : !permissions ? (
          <Text style={styles.text}>カメラと位置情報を確認しています…</Text>
        ) : !allowed ? (
          <ScrollView
            accessibilityLabel="撮影の許可案内"
            style={styles.permissionScroll}
            contentContainerStyle={styles.permissionContent}
          >
            <Text style={styles.text}>
              その場の思い出を残すため、カメラとアプリ使用中の正確な位置情報が必要です。写真ライブラリ・マイク・背景位置情報は使用しません。
            </Text>
            {(permissions.camera.canAskAgain ||
              permissions.location.canAskAgain) && (
              <Action
                label="カメラと位置情報を許可"
                disabled={busy}
                onPress={() => {
                  void refreshPermissions(true);
                }}
              />
            )}
            <Action
              label="端末の設定を開く"
              onPress={() => {
                void Linking.openSettings().catch(() =>
                  setError(
                    '設定を開けませんでした。端末の設定から許可を変更してください。',
                  ),
                );
              }}
            />
          </ScrollView>
        ) : draft ? (
          <Image
            accessibilityLabel="撮影した写真"
            source={{ uri: draft.photo.uri }}
            resizeMode="contain"
            style={styles.photo}
          />
        ) : (
          CameraComponent && (
            <CameraComponent
              ref={camera}
              facing="back"
              mode="picture"
              mute
              accessibilityLabel="撮影プレビュー"
              style={styles.camera}
              onCameraReady={() => setReady(true)}
              onMountError={() => {
                setReady(false);
                setError(
                  'カメラを起動できませんでした。キャンセルして端末のカメラ設定を確認してください。',
                );
              }}
            />
          )
        )}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {busy && (
        <View style={styles.busy}>
          <ActivityIndicator color="#E7A84B" />
          <Text style={styles.text}>準備しています…</Text>
        </View>
      )}
      {draft && (
        <View>
          <Action
            label="撮り直す"
            disabled={busy}
            onPress={() => {
              void retake();
            }}
          />
          <Action label="投稿する" disabled onPress={() => {}} />
        </View>
      )}
      {runtime && !permissions && error && (
        <Action
          label="再試行"
          disabled={busy}
          onPress={() => {
            void refreshPermissions(false);
          }}
        />
      )}
      {allowed && !draft && !stopped && (
        <Action
          label="撮影する"
          disabled={busy || !ready}
          onPress={() => {
            void shoot();
          }}
        />
      )}
      {!draft && (
        <Action
          label="キャンセル"
          onPress={() => {
            void close();
          }}
          secondary
        />
      )}
    </SafeAreaView>
  );
};
const Action = ({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.button,
      secondary && styles.secondary,
      disabled && styles.disabled,
    ]}
  >
    <Text style={[styles.buttonText, secondary && styles.text]}>{label}</Text>
  </Pressable>
);
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B2638', paddingHorizontal: 16 },
  content: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#102F42',
  },
  camera: { flex: 1 },
  text: { color: '#DDE7ED', fontSize: 15, lineHeight: 23, padding: 8 },
  permissionScroll: { flex: 1 },
  permissionContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 12,
    padding: 12,
  },
  photo: { flex: 1, width: '100%', minHeight: 0 },
  error: { color: '#FFBABA', paddingVertical: 8, fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  button: {
    backgroundColor: '#E7A84B',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    padding: 10,
  },
  buttonText: { color: '#102B3D', fontWeight: '800', fontSize: 16 },
  secondary: { backgroundColor: '#244354' },
  disabled: { opacity: 0.45 },
});
