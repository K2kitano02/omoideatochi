import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GoogleMap } from '../components/GoogleMap';
import { getMapAvailability } from '../config/maps';
import { getGroupService } from '../features/groups/groups';
import { getMemoryService } from '../features/memories/memories';
import { useMemoryMap } from '../features/memories/useMemoryMap';
import { CaptureScreen } from './CaptureScreen';

let NativeGoogleMap: typeof GoogleMap | undefined;

const ExpoGoCapture = ({ isFocused }: { isFocused: boolean }) => {
  const [capturing, setCapturing] = useState(false);
  if (!isFocused && capturing) setCapturing(false);
  return (
    <>
      <Text style={styles.placeholderText}>
        Expo
        Goでも撮影と撮影時の位置情報を確認できます。地図の確認には専用開発ビルドを使用してください。
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="投稿"
        accessibilityHint="カメラで思い出を撮影します。"
        accessibilityState={{ disabled: !isFocused }}
        disabled={!isFocused}
        onPress={() => setCapturing(true)}
        style={styles.captureButton}
      >
        <Text style={styles.captureButtonText}>投稿</Text>
      </Pressable>
      {capturing && isFocused && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setCapturing(false)}
        >
          <CaptureScreen onClose={() => setCapturing(false)} />
        </Modal>
      )}
    </>
  );
};

const MapContent = ({
  isFocused,
  MapComponent,
}: {
  isFocused: boolean;
  MapComponent?: typeof GoogleMap;
}) => {
  const groupService = useMemo(() => getGroupService(), []);
  const memoryService = useMemo(() => getMemoryService(), []);
  const data = useMemoryMap({ isFocused, groupService, memoryService });
  const [capturing, setCapturing] = useState(false);
  if (!isFocused && capturing) setCapturing(false);
  const groupIds = useMemo(
    () => data.groups.map((group) => group.id).sort(),
    [data.groups],
  );
  return (
    <>
      <View style={styles.filters}>
        <View style={styles.filterToolbar}>
          <Text style={styles.filterTitle}>● 自分の投稿</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="投稿を再取得"
            accessibilityHint="所属グループと投稿を更新します。地図の位置と倍率は変わりません。"
            accessibilityState={{ disabled: data.loading }}
            disabled={data.loading}
            onPress={() => {
              void data.refresh();
            }}
            style={[styles.refresh, data.loading && styles.disabledRefresh]}
          >
            <Text style={styles.refreshIcon}>↻</Text>
          </Pressable>
        </View>
        {data.groups.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.choices}
          >
            {data.groups.map((group) => {
              const checked = data.selectedGroupIds.includes(group.id);
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${group.name}を地図に表示`}
                  accessibilityState={{ checked, disabled: data.loadingGroups }}
                  disabled={data.loadingGroups}
                  onPress={() => data.toggleGroup(group.id)}
                  style={[styles.choice, checked && styles.checkedChoice]}
                >
                  <Text
                    style={[styles.choiceText, checked && styles.checkedText]}
                  >
                    {checked ? '☑' : '☐'} G{groupIds.indexOf(group.id) + 1}{' '}
                    {group.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
      {(data.loading || data.error || data.posts.length === 0) && (
        <View style={styles.dataStatus} accessibilityLiveRegion="polite">
          {data.loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#E7A84B" />
              <Text style={styles.filterHint}>投稿を読み込んでいます…</Text>
            </View>
          ) : (
            <Text style={data.error ? styles.error : styles.filterHint}>
              {data.error ?? '表示する投稿はありません。'}
            </Text>
          )}
        </View>
      )}
      <View style={styles.mapContainer}>
        {MapComponent && (
          <MapComponent
            posts={data.posts}
            groupIds={groupIds}
            onCapture={() => setCapturing(true)}
          />
        )}
      </View>
      {data.moreError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {data.moreError}
        </Text>
      )}
      {capturing && isFocused && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setCapturing(false)}
        >
          <CaptureScreen onClose={() => setCapturing(false)} />
        </Modal>
      )}
      {data.nextCursor && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="投稿の続きを読み込む"
          accessibilityState={{ disabled: data.loading || data.loadingMore }}
          disabled={data.loading || data.loadingMore}
          onPress={() => {
            void data.loadMore();
          }}
          style={styles.more}
        >
          <Text style={styles.refreshText}>
            {data.loadingMore
              ? '続きを読み込んでいます…'
              : '投稿の続きを読み込む'}
          </Text>
        </Pressable>
      )}
    </>
  );
};

export const MapScreen = ({
  isFocused = true,
  currentUserId,
}: {
  isFocused?: boolean;
  currentUserId?: string;
}) => {
  const availability = getMapAvailability();
  // Native maps enforce module availability at import time. Do not import them
  // while showing the Expo Go / missing-key / unsupported fallback.
  const MapComponent =
    availability.status === 'ready' && isFocused
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- Defer native module enforcement until maps are usable.
        (NativeGoogleMap ??= require('../components/GoogleMap').GoogleMap)
      : undefined;
  return (
    <SafeAreaView accessibilityLabel="地図画面" style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          思い出の地図
        </Text>
      </View>

      {availability.status === 'ready' ? (
        <MapContent
          key={currentUserId}
          isFocused={isFocused}
          MapComponent={MapComponent}
        />
      ) : (
        <View style={styles.mapContainer}>
          <View style={styles.notice}>
            <Text style={styles.placeholderTitle}>地図を表示するには</Text>
            <Text style={styles.placeholderText}>{availability.message}</Text>
            {availability.status === 'expo-go' && (
              <ExpoGoCapture key={currentUserId} isFocused={isFocused} />
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
    paddingHorizontal: 12,
  },
  header: {
    paddingTop: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mapContainer: {
    backgroundColor: '#F6F9FA',
    borderRadius: 18,
    flex: 1,
    marginBottom: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  filters: { marginTop: 2, gap: 2 },
  filterToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: { color: '#E7A84B', fontSize: 13, fontWeight: '800' },
  filterHint: { color: '#AFC2CF', fontSize: 12, lineHeight: 18 },
  choices: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#486477',
    backgroundColor: '#102F42',
  },
  checkedChoice: { borderColor: '#E7A84B', backgroundColor: '#293B40' },
  choiceText: { color: '#C5D3DC', fontSize: 13, fontWeight: '600' },
  checkedText: { color: '#F5CE91' },
  dataStatus: {
    paddingVertical: 4,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  error: { color: '#FFBCAC', fontSize: 12, lineHeight: 18, flexShrink: 1 },
  refresh: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledRefresh: { opacity: 0.4 },
  refreshIcon: { color: '#E7A84B', fontSize: 28, fontWeight: '600' },
  refreshText: { color: '#E7A84B', fontSize: 12, fontWeight: '700' },
  more: { paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  notice: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  placeholderTitle: {
    color: '#102B3D',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderText: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  captureButton: {
    backgroundColor: '#BC7C20',
    borderRadius: 12,
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
