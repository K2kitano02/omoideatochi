import { useMemo } from 'react';
import {
  ActivityIndicator,
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

let NativeGoogleMap: typeof GoogleMap | undefined;

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
  const groupIds = useMemo(
    () => data.groups.map((group) => group.id).sort(),
    [data.groups],
  );
  return (
    <>
      <View style={styles.filters}>
        <Text style={styles.filterTitle}>● 自分の投稿</Text>
        <Text style={styles.filterHint}>グループの思い出も表示する</Text>
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
          {!data.loading && data.groups.length === 0 && (
            <Text style={styles.filterHint}>
              表示できるグループはありません。
            </Text>
          )}
        </ScrollView>
      </View>
      <View style={styles.dataStatus} accessibilityLiveRegion="polite">
        {data.loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#E7A84B" />
            <Text style={styles.filterHint}>投稿を読み込んでいます…</Text>
          </View>
        ) : (
          <Text style={data.error ? styles.error : styles.filterHint}>
            {data.error ??
              (data.posts.length
                ? `${data.posts.length}件読み込み済み`
                : '表示する投稿はありません。')}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: data.loading }}
          disabled={data.loading}
          onPress={() => {
            void data.refresh();
          }}
          style={styles.refresh}
        >
          <Text style={styles.refreshText}>投稿を再取得</Text>
        </Pressable>
      </View>
      <View style={styles.mapContainer}>
        {MapComponent && (
          <MapComponent posts={data.posts} groupIds={groupIds} />
        )}
      </View>
      {data.moreError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {data.moreError}
        </Text>
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
        <Text style={styles.eyebrow}>MEMORY MAP</Text>
        <Text accessibilityRole="header" style={styles.title}>
          思い出の地図
        </Text>
        <Text style={styles.description}>
          自分が残した思い出を、ここからいつでも振り返れます。
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
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 28,
  },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  mapContainer: {
    backgroundColor: '#F6F9FA',
    borderRadius: 28,
    flex: 1,
    marginBottom: 20,
    marginTop: 12,
    overflow: 'hidden',
  },
  filters: { marginTop: 16, gap: 8 },
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
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  error: { color: '#FFBCAC', fontSize: 12, lineHeight: 18, flexShrink: 1 },
  refresh: { paddingVertical: 10, paddingHorizontal: 8, flexShrink: 0 },
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
});
