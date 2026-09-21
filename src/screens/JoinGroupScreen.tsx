import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroupInvitationService } from '../features/groups/groupInvitations';
import type {
  GroupInvitationPreview,
  GroupInvitationService,
  MyGroupJoinRequest,
} from '../features/groups/groupInvitationService';

type JoinGroupService = Pick<
  GroupInvitationService,
  | 'previewInvitation'
  | 'redeemInvitation'
  | 'listMyJoinRequests'
  | 'cancelJoinRequest'
>;

type JoinGroupScreenProps = {
  invitationService?: JoinGroupService;
  onBack: () => void;
  onJoined: (groupId: string) => void;
};

const normalizeToken = (value: string) =>
  value.replace(/\s/g, '').toLowerCase();

const statusLabel = (status: MyGroupJoinRequest['status']) => {
  switch (status) {
    case 'pending':
      return '承認待ち';
    case 'approved':
      return '承認されました';
    case 'rejected':
      return '拒否されました';
    case 'cancelled':
      return '取り消しました';
  }
};

export const JoinGroupScreen = ({
  invitationService,
  onBack,
  onJoined,
}: JoinGroupScreenProps) => {
  const service = useMemo(
    () => invitationService ?? getGroupInvitationService(),
    [invitationService],
  );
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<GroupInvitationPreview>();
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingMessage, setPendingMessage] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [myRequests, setMyRequests] = useState<MyGroupJoinRequest[]>([]);
  const [requestError, setRequestError] = useState<string>();
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [cancellingRequestId, setCancellingRequestId] = useState<string>();
  const mountedRef = useRef(true);
  const previewInProgressRef = useRef(false);
  const redeemInProgressRef = useRef(false);
  const cancellingRequestIdsRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMyRequests = async () => {
      const result = await service.listMyJoinRequests();

      if (cancelled) {
        return;
      }

      if (result.ok) {
        setMyRequests(result.requests);
      } else {
        setRequestError(result.error.message);
      }
      setIsLoadingRequests(false);
    };

    void loadMyRequests();

    return () => {
      cancelled = true;
    };
  }, [service]);

  const checkInvitation = async () => {
    const normalizedToken = normalizeToken(code);

    if (!normalizedToken) {
      setError('招待コードを入力してください。');
      return;
    }
    if (previewInProgressRef.current) {
      return;
    }

    previewInProgressRef.current = true;
    setIsPreviewing(true);
    setError(undefined);
    setPendingMessage(false);

    try {
      const result = await service.previewInvitation(normalizedToken);

      if (!mountedRef.current) {
        return;
      }

      if (result.ok) {
        setCode(normalizedToken);
        setPreview(result.preview);
        setConsented(false);
      } else {
        setPreview(undefined);
        setError(result.error.message);
      }
    } finally {
      previewInProgressRef.current = false;
      if (mountedRef.current) {
        setIsPreviewing(false);
      }
    }
  };

  const redeemInvitation = async () => {
    if (!preview || !consented || redeemInProgressRef.current) {
      return;
    }

    redeemInProgressRef.current = true;
    setIsRedeeming(true);
    setError(undefined);

    try {
      const result = await service.redeemInvitation(normalizeToken(code), true);

      if (!mountedRef.current) {
        return;
      }

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      if (result.result.status === 'joined') {
        onJoined(result.result.groupId);
        return;
      }

      const { groupId: pendingGroupId, requestId } = result.result;

      setMyRequests((current) => [
        {
          requestId,
          groupId: pendingGroupId,
          groupName: preview.groupName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        },
        ...current.filter((request) => request.requestId !== requestId),
      ]);
      setPendingMessage(true);
      setPreview(undefined);
      setConsented(false);
      setCode('');
    } finally {
      redeemInProgressRef.current = false;
      if (mountedRef.current) {
        setIsRedeeming(false);
      }
    }
  };

  const cancelJoinRequest = async (requestId: string) => {
    if (cancellingRequestIdsRef.current.has(requestId)) {
      return;
    }

    cancellingRequestIdsRef.current.add(requestId);
    setCancellingRequestId(requestId);
    setRequestError(undefined);

    try {
      const result = await service.cancelJoinRequest(requestId);

      if (!mountedRef.current) {
        return;
      }

      if (result.ok) {
        setMyRequests((current) =>
          current.filter((request) => request.requestId !== requestId),
        );
      } else {
        setRequestError(result.error.message);
      }
    } finally {
      cancellingRequestIdsRef.current.delete(requestId);
      if (mountedRef.current) {
        setCancellingRequestId((current) =>
          current === requestId ? undefined : current,
        );
      }
    }
  };

  const discardPreview = () => {
    setPreview(undefined);
    setConsented(false);
    setError(undefined);
  };

  return (
    <SafeAreaView accessibilityLabel="招待コード参加画面" style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
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
          <Text style={styles.navigationTitle}>JOIN A GROUP</Text>
          <View style={styles.navigationSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons color="#E7A84B" name="key-outline" size={26} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              招待コードで参加
            </Text>
            <Text style={styles.subtitle}>
              受け取ったコードからグループを確認します。
            </Text>
          </View>

          <View style={styles.formCard}>
            {!preview ? (
              <>
                <Text style={styles.inputLabel}>招待コード</Text>
                <TextInput
                  accessibilityLabel="招待コード"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setCode}
                  placeholder="コードを貼り付け"
                  placeholderTextColor="#8FA0A9"
                  style={styles.input}
                  value={code}
                />
                <Pressable
                  accessibilityLabel="招待内容を確認"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPreviewing }}
                  disabled={isPreviewing}
                  onPress={() => {
                    void checkInvitation();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !isPreviewing && styles.primaryButtonPressed,
                    isPreviewing && styles.disabled,
                  ]}
                >
                  {isPreviewing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>招待内容を確認</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardEyebrow}>INVITED GROUP</Text>
                <Text style={styles.groupName}>{preview.groupName}</Text>
                <View style={styles.approvalNotice}>
                  <Ionicons
                    color="#9B5D10"
                    name={
                      preview.requiresApproval
                        ? 'time-outline'
                        : 'flash-outline'
                    }
                    size={20}
                  />
                  <Text style={styles.approvalText}>
                    {preview.requiresApproval
                      ? '参加にはオーナーの承認が必要です'
                      : 'すぐに参加できます'}
                  </Text>
                </View>
                <View style={styles.consentBox}>
                  <Text style={styles.consentDescription}>
                    参加すると、グループで共有された過去の写真・メモ・正確な位置情報を閲覧できます。
                  </Text>
                  <Pressable
                    accessibilityLabel="共有範囲に同意する"
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consented }}
                    onPress={() => setConsented((current) => !current)}
                    style={styles.checkboxRow}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        consented && styles.checkboxChecked,
                      ]}
                    >
                      {consented ? (
                        <Ionicons color="#FFFFFF" name="checkmark" size={16} />
                      ) : null}
                    </View>
                    <Text style={styles.checkboxLabel}>共有範囲に同意する</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityLabel={
                    preview.requiresApproval
                      ? '参加を申し込む'
                      : 'グループに参加'
                  }
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !consented || isRedeeming }}
                  disabled={!consented || isRedeeming}
                  onPress={() => {
                    void redeemInvitation();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && consented && styles.primaryButtonPressed,
                    (!consented || isRedeeming) && styles.disabled,
                  ]}
                >
                  {isRedeeming ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {preview.requiresApproval
                        ? '参加を申し込む'
                        : 'グループに参加'}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityLabel="この招待を使わない"
                  accessibilityRole="button"
                  onPress={discardPreview}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    この招待を使わない
                  </Text>
                </Pressable>
              </>
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
            {pendingMessage ? (
              <View style={styles.successNotice}>
                <Ionicons color="#28704D" name="checkmark-circle" size={20} />
                <Text style={styles.successText}>
                  オーナーの承認を待っています
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>自分の参加申請</Text>
            {isLoadingRequests ? (
              <ActivityIndicator color="#E7A84B" style={styles.loader} />
            ) : requestError ? (
              <Text accessibilityRole="alert" style={styles.requestErrorText}>
                {requestError}
              </Text>
            ) : myRequests.length === 0 ? (
              <Text style={styles.emptyText}>参加申請はありません</Text>
            ) : (
              myRequests.map((request) => {
                const isCancelling = cancellingRequestId === request.requestId;

                return (
                  <View key={request.requestId} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.requestName}>
                        {request.groupName}への参加申請
                      </Text>
                      <Text style={styles.requestStatus}>
                        {statusLabel(request.status)}
                      </Text>
                    </View>
                    {request.status === 'pending' ? (
                      <Pressable
                        accessibilityLabel={`${request.groupName}への参加申請を取り消す`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isCancelling }}
                        disabled={isCancelling}
                        onPress={() => {
                          void cancelJoinRequest(request.requestId);
                        }}
                        style={({ pressed }) => [
                          styles.cancelButton,
                          pressed &&
                            !isCancelling &&
                            styles.cancelButtonPressed,
                          isCancelling && styles.disabled,
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>
                          {isCancelling ? '取消中…' : '申請を取り消す'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: '#0B2638', flex: 1 },
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
  backButtonPressed: { backgroundColor: '#183B4E' },
  navigationTitle: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  navigationSpacer: { width: 40 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingBottom: 24, paddingTop: 18 },
  iconCircle: {
    alignItems: 'center',
    borderColor: 'rgba(231, 168, 75, 0.45)',
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 14 },
  subtitle: { color: '#AFC2CF', fontSize: 13, marginTop: 7 },
  formCard: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  inputLabel: { color: '#163344', fontSize: 14, fontWeight: '800' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C8D6DC',
    borderRadius: 13,
    borderWidth: 1,
    color: '#163344',
    fontFamily: 'Courier',
    fontSize: 14,
    marginTop: 9,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  cardEyebrow: {
    color: '#B26D18',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  groupName: {
    color: '#163344',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  approvalNotice: {
    alignItems: 'center',
    backgroundColor: '#FFF0D8',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  approvalText: { color: '#8A5413', flex: 1, fontSize: 12, fontWeight: '700' },
  consentBox: {
    borderColor: '#D8E1E5',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  consentDescription: { color: '#526A77', fontSize: 12, lineHeight: 19 },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#8FA0A9',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: { backgroundColor: '#D68B21', borderColor: '#D68B21' },
  checkboxLabel: { color: '#163344', fontSize: 13, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#D68B21',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  primaryButtonPressed: { backgroundColor: '#BD7415' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  secondaryButtonText: { color: '#526A77', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  errorText: {
    color: '#9C342C',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
  },
  successNotice: {
    alignItems: 'center',
    backgroundColor: '#E5F3EB',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  successText: { color: '#28704D', flex: 1, fontSize: 12, fontWeight: '700' },
  requestsSection: { marginTop: 26 },
  sectionTitle: { color: '#F6F9FA', fontSize: 16, fontWeight: '800' },
  loader: { marginTop: 16 },
  emptyText: { color: '#AFC2CF', fontSize: 13, marginTop: 12 },
  requestErrorText: { color: '#FFB8AE', fontSize: 12, marginTop: 12 },
  requestCard: {
    backgroundColor: '#F6F9FA',
    borderRadius: 15,
    marginTop: 12,
    padding: 15,
  },
  requestHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  requestName: { color: '#163344', flex: 1, fontSize: 13, fontWeight: '700' },
  requestStatus: { color: '#9B5D10', fontSize: 11, fontWeight: '800' },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#C8D6DC',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 13,
    paddingVertical: 10,
  },
  cancelButtonPressed: { backgroundColor: '#E8EFF2' },
  cancelButtonText: { color: '#526A77', fontSize: 12, fontWeight: '800' },
});
