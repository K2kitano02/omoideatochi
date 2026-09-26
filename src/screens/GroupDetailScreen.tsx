import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroupService } from '../features/groups/groups';
import type {
  GroupDetails,
  GroupFailure,
  GroupMember,
  GroupService,
} from '../features/groups/groupService';

type GroupDetailScreenProps = {
  currentUserId?: string;
  groupId: string;
  groupService?: Pick<GroupService, 'getGroupDetails'>;
  onBack: () => void;
  onInvite?: (params: {
    groupId: string;
    groupName: string;
    isOwner: boolean;
  }) => void;
  pendingCount?: number;
};

type GroupDetailSource = {
  groupId: string;
  service: Pick<GroupService, 'getGroupDetails'>;
};

const shortenUserId = (userId: string) =>
  `${userId.slice(0, 8)}…${userId.slice(-4)}`;

export const GroupDetailScreen = ({
  currentUserId,
  groupId,
  groupService,
  onBack,
  onInvite,
  pendingCount = 0,
}: GroupDetailScreenProps) => {
  const service = useMemo(
    () => groupService ?? getGroupService(),
    [groupService],
  );
  const [group, setGroup] = useState<GroupDetails>();
  const [error, setError] = useState<GroupFailure>();
  const [resolvedSource, setResolvedSource] = useState<GroupDetailSource>();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const latestLoadRef = useRef(0);

  const loadGroup = useCallback(async () => {
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;

    const result = await service.getGroupDetails(groupId);

    if (!mountedRef.current || latestLoadRef.current !== loadId) {
      return;
    }

    if (result.ok) {
      setGroup(result.group);
      setError(undefined);
    } else {
      setGroup(undefined);
      setError(result.error);
    }

    setResolvedSource({ groupId, service });
    setIsInitialLoading(false);
    setIsRefreshing(false);
  }, [groupId, service]);

  useEffect(() => {
    mountedRef.current = true;
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;

    void service.getGroupDetails(groupId).then((result) => {
      if (!mountedRef.current || latestLoadRef.current !== loadId) {
        return;
      }

      if (result.ok) {
        setGroup(result.group);
        setError(undefined);
      } else {
        setGroup(undefined);
        setError(result.error);
      }

      setResolvedSource({ groupId, service });
      setIsInitialLoading(false);
      setIsRefreshing(false);
    });

    return () => {
      mountedRef.current = false;
      latestLoadRef.current += 1;
    };
  }, [groupId, service]);

  const isLoadingCurrentSource =
    isInitialLoading ||
    resolvedSource?.groupId !== groupId ||
    resolvedSource.service !== service;

  return (
    <SafeAreaView accessibilityLabel="グループ詳細画面" style={styles.screen}>
      <View style={styles.navigationBar}>
        <Pressable
          accessibilityLabel="グループ一覧に戻る"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.navigationTitle}>GROUP DETAILS</Text>
        <View style={styles.navigationSpacer} />
      </View>

      {isLoadingCurrentSource ? (
        <View style={styles.centeredState}>
          <ActivityIndicator
            accessibilityLabel="グループ詳細を読み込み中"
            color="#E7A84B"
            size="large"
          />
          <Text style={styles.loadingText}>詳細を読み込んでいます</Text>
        </View>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            setIsInitialLoading(true);
            setError(undefined);
            void loadGroup();
          }}
        />
      ) : group ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              colors={['#D69332']}
              onRefresh={() => {
                setIsRefreshing(true);
                setError(undefined);
                void loadGroup();
              }}
              refreshing={isRefreshing}
              tintColor="#E7A84B"
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.memoryMark}>
              <View style={styles.memoryOuterRing} />
              <View style={styles.memoryInnerRing} />
              <View style={styles.memoryCore} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {group.name}
            </Text>
            <Text style={styles.subtitle}>このグループで共有する思い出</Text>
          </View>

          <Pressable
            accessibilityLabel={`メンバーを招待${
              pendingCount > 0 ? `、承認待ち${pendingCount}件` : ''
            }`}
            accessibilityRole="button"
            onPress={() =>
              onInvite?.({
                groupId: group.id,
                groupName: group.name,
                isOwner: group.createdBy === currentUserId,
              })
            }
            style={({ pressed }) => [
              styles.inviteButton,
              pressed && styles.inviteButtonPressed,
            ]}
          >
            <View style={styles.inviteIcon}>
              <Ionicons color="#D68B21" name="person-add-outline" size={19} />
            </View>
            <View style={styles.inviteTextArea}>
              <Text style={styles.inviteTitle}>メンバーを招待</Text>
              <Text style={styles.inviteDescription}>
                10分間有効なコードを発行
              </Text>
            </View>
            {pendingCount > 0 ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  承認待ち {pendingCount}件
                </Text>
              </View>
            ) : null}
            <Ionicons color="#6F818B" name="chevron-forward" size={20} />
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>メンバー</Text>
            <View
              accessibilityLabel={`メンバー${group.members.length}人`}
              style={styles.countBadge}
            >
              <Text style={styles.countText}>{group.members.length}人</Text>
            </View>
          </View>

          {group.members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons color="#6F818B" name="people-outline" size={30} />
              <Text style={styles.emptyTitle}>メンバーはいません</Text>
              <Text style={styles.emptyText}>
                現在表示できるメンバー情報がありません。
              </Text>
            </View>
          ) : (
            <View style={styles.memberList}>
              {group.members.map((member) => (
                <MemberCard key={member.userId} member={member} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

type MemberCardProps = {
  member: GroupMember;
};

const MemberCard = ({ member }: MemberCardProps) => {
  const isOwner = member.role === 'owner';
  const roleLabel = isOwner ? '作成者' : 'メンバー';

  return (
    <View
      accessibilityLabel={`${roleLabel} ${member.userId}`}
      style={styles.memberCard}
    >
      <View style={isOwner ? styles.ownerMark : styles.memberMark}>
        {isOwner ? <View style={styles.ownerMarkCore} /> : null}
      </View>
      <View style={styles.memberDetails}>
        <Text style={styles.memberId}>{shortenUserId(member.userId)}</Text>
        <Text style={styles.memberDescription}>
          {isOwner ? 'グループを作成したメンバー' : '参加メンバー'}
        </Text>
      </View>
      <View style={[styles.roleBadge, isOwner && styles.ownerBadge]}>
        <Text style={[styles.roleText, isOwner && styles.ownerRoleText]}>
          {roleLabel}
        </Text>
      </View>
    </View>
  );
};

type ErrorStateProps = {
  error: GroupFailure;
  onRetry: () => void;
};

const ErrorState = ({ error, onRetry }: ErrorStateProps) => (
  <View style={styles.centeredState}>
    <View style={styles.errorIcon}>
      <Ionicons
        color="#9C342C"
        name={
          error.type === 'permission-denied'
            ? 'lock-closed-outline'
            : 'cloud-offline-outline'
        }
        size={30}
      />
    </View>
    <Text accessibilityRole="alert" style={styles.errorText}>
      {error.message}
    </Text>
    <Pressable
      accessibilityRole="button"
      onPress={onRetry}
      style={({ pressed }) => [
        styles.retryButton,
        pressed && styles.retryButtonPressed,
      ]}
    >
      <Text style={styles.retryButtonText}>再読み込み</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
  },
  navigationBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backButtonPressed: {
    backgroundColor: '#183B4E',
  },
  navigationTitle: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  navigationSpacer: {
    width: 40,
  },
  centeredState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 72,
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#AFC2CF',
    fontSize: 13,
    marginTop: 14,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: 24,
  },
  memoryMark: {
    alignItems: 'center',
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  memoryOuterRing: {
    borderColor: '#D69332',
    borderRadius: 36,
    borderWidth: 1.5,
    height: 72,
    opacity: 0.35,
    position: 'absolute',
    width: 72,
  },
  memoryInnerRing: {
    borderColor: '#E7A84B',
    borderRadius: 25,
    borderWidth: 1.5,
    height: 50,
    opacity: 0.65,
    position: 'absolute',
    width: 50,
  },
  memoryCore: {
    backgroundColor: '#FFD084',
    borderColor: '#FFF2D5',
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 14,
  },
  subtitle: {
    color: '#AFC2CF',
    fontSize: 14,
    marginTop: 8,
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 17,
    flexDirection: 'row',
    marginBottom: 24,
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inviteButtonPressed: { backgroundColor: '#E8EFF2' },
  inviteIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0D8',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  inviteTextArea: { flex: 1, marginLeft: 12 },
  inviteTitle: { color: '#163344', fontSize: 14, fontWeight: '800' },
  inviteDescription: { color: '#71848E', fontSize: 11, marginTop: 4 },
  pendingBadge: {
    backgroundColor: '#FFF0D8',
    borderRadius: 10,
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pendingBadgeText: { color: '#9B5D10', fontSize: 10, fontWeight: '800' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F6F9FA',
    fontSize: 15,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: '#183B4E',
    borderColor: '#315365',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  countText: {
    color: '#F1C47D',
    fontSize: 12,
    fontWeight: '800',
  },
  memberList: {
    gap: 10,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 18,
    flexDirection: 'row',
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ownerMark: {
    alignItems: 'center',
    borderColor: '#D69332',
    borderRadius: 22,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  ownerMarkCore: {
    backgroundColor: '#D69332',
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  memberMark: {
    backgroundColor: '#DCE7EC',
    borderColor: '#B9CBD4',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
  memberDetails: {
    flex: 1,
    marginLeft: 13,
  },
  memberId: {
    color: '#163344',
    fontSize: 14,
    fontWeight: '800',
  },
  memberDescription: {
    color: '#71848E',
    fontSize: 11,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#E7EEF1',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  ownerBadge: {
    backgroundColor: '#FFF0D8',
  },
  roleText: {
    color: '#49616E',
    fontSize: 10,
    fontWeight: '800',
  },
  ownerRoleText: {
    color: '#9B5D10',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: '#183646',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyText: {
    color: '#6F818B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  errorIcon: {
    alignItems: 'center',
    backgroundColor: '#FCE8E6',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  errorText: {
    color: '#F4D3CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderColor: '#7590A0',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 46,
    paddingHorizontal: 24,
  },
  retryButtonPressed: {
    backgroundColor: '#183B4E',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
