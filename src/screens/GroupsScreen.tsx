import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroupService } from '../features/groups/groups';
import type { Group, GroupService } from '../features/groups/groupService';

type GroupsScreenProps = {
  groupService?: GroupService;
  onJoinByCode?: () => void;
  onSelectGroup: (groupId: string) => void;
  pendingCounts?: Readonly<Record<string, number>>;
};

const validateGroupName = (name: string): string | undefined => {
  if (!name.trim()) {
    return 'グループ名を入力してください';
  }

  if (name !== name.trim()) {
    return 'グループ名の前後に空白は使用できません';
  }

  if (Array.from(name).length > 100) {
    return 'グループ名は100文字以内で入力してください';
  }

  return undefined;
};

export const GroupsScreen = ({
  groupService,
  onJoinByCode,
  onSelectGroup,
  pendingCounts = {},
}: GroupsScreenProps) => {
  const service = useMemo(
    () => groupService ?? getGroupService(),
    [groupService],
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<string>();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [createError, setCreateError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);
  const mountedRef = useRef(true);
  const latestLoadRef = useRef(0);
  const createInProgressRef = useRef(false);

  const loadGroups = useCallback(async () => {
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;

    const result = await service.listGroups();

    if (!mountedRef.current || latestLoadRef.current !== loadId) {
      return;
    }

    if (result.ok) {
      setGroups(result.groups);
    } else {
      setListError(result.error.message);
    }

    setIsInitialLoading(false);
    setIsRefreshing(false);
  }, [service]);

  const refreshGroups = useCallback(async () => {
    setIsRefreshing(true);
    setListError(undefined);
    await loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    mountedRef.current = true;
    const loadId = latestLoadRef.current + 1;
    latestLoadRef.current = loadId;

    void service.listGroups().then((result) => {
      if (!mountedRef.current || latestLoadRef.current !== loadId) {
        return;
      }

      if (result.ok) {
        setGroups(result.groups);
      } else {
        setListError(result.error.message);
      }

      setIsInitialLoading(false);
    });

    return () => {
      mountedRef.current = false;
      latestLoadRef.current += 1;
    };
  }, [service]);

  const openCreateModal = () => {
    setGroupName('');
    setNameError(undefined);
    setCreateError(undefined);
    setIsCreateModalVisible(true);
  };

  const closeCreateModal = () => {
    if (createInProgressRef.current) {
      return;
    }

    setIsCreateModalVisible(false);
    setGroupName('');
    setNameError(undefined);
    setCreateError(undefined);
  };

  const handleCreateGroup = async () => {
    if (createInProgressRef.current) {
      return;
    }

    const validationError = validateGroupName(groupName);
    setNameError(validationError);
    setCreateError(undefined);

    if (validationError) {
      return;
    }

    createInProgressRef.current = true;
    setIsCreating(true);

    try {
      const result = await service.createGroup(groupName);

      if (!mountedRef.current) {
        return;
      }

      if (!result.ok) {
        setCreateError(result.error.message);
        return;
      }

      setIsCreateModalVisible(false);
      setGroupName('');
      setNameError(undefined);
      setCreateError(undefined);
      await refreshGroups();
    } finally {
      createInProgressRef.current = false;
      if (mountedRef.current) {
        setIsCreating(false);
      }
    }
  };

  const createButtonLabel =
    groups.length === 0 ? '最初のグループを作る' : '新しいグループを作る';

  return (
    <SafeAreaView accessibilityLabel="グループ画面" style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={['#D69332']}
            onRefresh={() => {
              void refreshGroups();
            }}
            refreshing={isRefreshing}
            tintColor="#E7A84B"
          />
        }
      >
        <Text style={styles.eyebrow}>SHARED MEMORIES</Text>
        <Text accessibilityRole="header" style={styles.title}>
          グループ
        </Text>
        <Text style={styles.description}>
          大切な人と共有する思い出を、グループごとに振り返れます。
        </Text>

        <Pressable
          accessibilityLabel="招待コードで参加"
          accessibilityRole="button"
          onPress={onJoinByCode}
          style={({ pressed }) => [
            styles.joinButton,
            pressed && styles.joinButtonPressed,
          ]}
        >
          <Ionicons color="#F1C47D" name="key-outline" size={19} />
          <Text style={styles.joinButtonText}>招待コードで参加</Text>
          <Ionicons color="#91A7B4" name="chevron-forward" size={18} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>所属グループ</Text>
          <View
            accessibilityLabel={`${groups.length}件、上限5件`}
            style={styles.countBadge}
          >
            <Text style={styles.countText}>{groups.length} / 5</Text>
          </View>
        </View>

        {isInitialLoading ? (
          <View style={styles.statusCard}>
            <ActivityIndicator
              accessibilityLabel="グループを読み込み中"
              color="#D69332"
              size="large"
            />
            <Text style={styles.statusText}>グループを読み込んでいます</Text>
          </View>
        ) : listError ? (
          <View style={styles.statusCard}>
            <View style={[styles.iconContainer, styles.errorIconContainer]}>
              <Ionicons
                color="#9C342C"
                name="cloud-offline-outline"
                size={30}
              />
            </View>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {listError}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void refreshGroups();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>再読み込み</Text>
            </Pressable>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.statusCard}>
            <View style={styles.memoryMark}>
              <View style={styles.memoryRing} />
              <View style={styles.memoryCore} />
            </View>
            <Text style={styles.emptyTitle}>まだグループはありません</Text>
            <Text style={styles.emptyText}>
              一緒に思い出を残したい人との、最初のグループを作りましょう。
            </Text>
            <CreateButton label={createButtonLabel} onPress={openCreateModal} />
          </View>
        ) : (
          <View style={styles.groupList}>
            {groups.map((group) => {
              const pendingCount = pendingCounts[group.id] ?? 0;

              return (
                <Pressable
                  accessibilityLabel={`${group.name}の詳細を開く${
                    pendingCount > 0 ? `、承認待ち${pendingCount}件` : ''
                  }`}
                  accessibilityRole="button"
                  key={group.id}
                  onPress={() => onSelectGroup(group.id)}
                  style={({ pressed }) => [
                    styles.groupCard,
                    pressed && styles.groupCardPressed,
                  ]}
                >
                  <View style={styles.groupMark}>
                    <View style={styles.groupMarkCore} />
                  </View>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {pendingCount > 0 ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>
                        承認待ち {pendingCount}件
                      </Text>
                    </View>
                  ) : null}
                  <Ionicons color="#6F818B" name="chevron-forward" size={20} />
                </Pressable>
              );
            })}
            <CreateButton label={createButtonLabel} onPress={openCreateModal} />
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeCreateModal}
        transparent
        visible={isCreateModalVisible}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View accessibilityViewIsModal style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>NEW GROUP</Text>
                <Text accessibilityRole="header" style={styles.modalTitle}>
                  グループを作る
                </Text>
              </View>
              <Pressable
                accessibilityLabel="作成画面を閉じる"
                accessibilityRole="button"
                accessibilityState={{ disabled: isCreating }}
                disabled={isCreating}
                hitSlop={10}
                onPress={closeCreateModal}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && !isCreating && styles.closeButtonPressed,
                ]}
              >
                <Ionicons color="#49616E" name="close" size={24} />
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              誰と共有する思い出か分かる名前を付けてください。
            </Text>

            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>グループ名</Text>
                <Text style={styles.fieldHint}>
                  {Array.from(groupName).length} / 100
                </Text>
              </View>
              <TextInput
                accessibilityLabel="グループ名"
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!isCreating}
                maxLength={101}
                onChangeText={(value) => {
                  setGroupName(value);
                  setNameError(undefined);
                  setCreateError(undefined);
                }}
                placeholder="例：家族"
                placeholderTextColor="#82919A"
                returnKeyType="done"
                selectionColor="#D69332"
                style={[styles.input, nameError && styles.inputError]}
                value={groupName}
              />
              {nameError ? (
                <Text accessibilityRole="alert" style={styles.fieldErrorText}>
                  {nameError}
                </Text>
              ) : null}
            </View>

            {createError ? (
              <View accessibilityRole="alert" style={styles.createErrorBox}>
                <Text style={styles.createErrorText}>{createError}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="グループを作成"
              accessibilityRole="button"
              accessibilityState={{ disabled: isCreating }}
              disabled={isCreating}
              onPress={() => {
                void handleCreateGroup();
              }}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && !isCreating && styles.submitButtonPressed,
                isCreating && styles.submitButtonDisabled,
              ]}
            >
              {isCreating ? (
                <ActivityIndicator
                  accessibilityLabel="グループ作成中"
                  color="#FFFFFF"
                />
              ) : (
                <Text style={styles.submitButtonText}>グループを作成</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

type CreateButtonProps = {
  label: string;
  onPress: () => void;
};

const CreateButton = ({ label, onPress }: CreateButtonProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.createButton,
      pressed && styles.createButtonPressed,
    ]}
  >
    <Ionicons color="#FFFFFF" name="add" size={20} />
    <Text style={styles.createButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
    paddingHorizontal: 20,
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
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  joinButton: {
    alignItems: 'center',
    backgroundColor: '#183B4E',
    borderColor: '#315365',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  joinButtonPressed: { backgroundColor: '#21485C' },
  joinButtonText: {
    color: '#F6F9FA',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
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
  statusCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 34,
  },
  statusText: {
    color: '#596D79',
    fontSize: 13,
    marginTop: 14,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  errorIconContainer: {
    backgroundColor: '#FCE8E6',
  },
  errorText: {
    color: '#7D302A',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#AEBEC6',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 46,
    paddingHorizontal: 24,
  },
  secondaryButtonPressed: {
    backgroundColor: '#E7EEF1',
  },
  secondaryButtonText: {
    color: '#294656',
    fontSize: 14,
    fontWeight: '800',
  },
  memoryMark: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  memoryRing: {
    borderColor: '#E7A84B',
    borderRadius: 28,
    borderWidth: 1.5,
    height: 56,
    opacity: 0.55,
    position: 'absolute',
    width: 56,
  },
  memoryCore: {
    backgroundColor: '#E7A84B',
    borderColor: '#FFE3B5',
    borderRadius: 10,
    borderWidth: 3,
    height: 20,
    width: 20,
  },
  emptyTitle: {
    color: '#102B3D',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyText: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  groupList: {
    gap: 12,
    marginTop: 16,
  },
  groupCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 18,
    flexDirection: 'row',
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  pendingBadge: {
    backgroundColor: '#FFF0D8',
    borderRadius: 10,
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pendingBadgeText: { color: '#9B5D10', fontSize: 10, fontWeight: '800' },
  groupMark: {
    alignItems: 'center',
    borderColor: '#E7A84B',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  groupMarkCore: {
    backgroundColor: '#D69332',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  groupName: {
    color: '#102B3D',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 14,
  },
  groupCardPressed: {
    backgroundColor: '#E7EEF1',
    transform: [{ scale: 0.99 }],
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#D38A22',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  createButtonPressed: {
    backgroundColor: '#B87318',
    transform: [{ scale: 0.99 }],
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    backgroundColor: 'rgba(4, 20, 30, 0.76)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    alignSelf: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 26,
    maxWidth: 420,
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalEyebrow: {
    color: '#B56F15',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  modalTitle: {
    color: '#102B3D',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 5,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#E8EFF2',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  closeButtonPressed: {
    backgroundColor: '#D8E3E8',
  },
  modalDescription: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  fieldGroup: {
    marginTop: 22,
  },
  fieldLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#17384A',
    fontSize: 14,
    fontWeight: '800',
  },
  fieldHint: {
    color: '#72848F',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9D5DA',
    borderRadius: 13,
    borderWidth: 1.5,
    color: '#102B3D',
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  inputError: {
    borderColor: '#B94B42',
  },
  fieldErrorText: {
    color: '#9C342C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  createErrorBox: {
    backgroundColor: '#FCE8E6',
    borderRadius: 10,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  createErrorText: {
    color: '#8F2720',
    fontSize: 12,
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#D38A22',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
  },
  submitButtonPressed: {
    backgroundColor: '#B87318',
    transform: [{ scale: 0.99 }],
  },
  submitButtonDisabled: {
    opacity: 0.68,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
