import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getGroupInvitationService } from '../features/groups/groupInvitations';
import type {
  GroupInvitation,
  GroupInvitationService,
  GroupJoinRequest,
} from '../features/groups/groupInvitationService';

type InvitationManagementService = Pick<
  GroupInvitationService,
  'createInvitation' | 'listJoinRequests' | 'resolveJoinRequest'
>;

type GroupInvitationScreenProps = {
  copyText?: (text: string) => Promise<boolean>;
  groupId: string;
  groupName: string;
  invitationService?: InvitationManagementService;
  isOwner: boolean;
  onBack: () => void;
  onPendingCountsChanged?: () => void;
};

const copySensitiveText = (text: string) => Clipboard.setStringAsync(text);

const formatToken = (token: string) =>
  token.match(/.{1,8}/g)?.join(' ') ?? token;

const formatExpiry = (expiresAt: string) =>
  new Date(expiresAt).toLocaleString('ja-JP', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  });

const formatApplicantId = (applicantId: string) =>
  `利用者 ${applicantId.slice(0, 8)}…${applicantId.slice(-4)}`;

export const GroupInvitationScreen = ({
  copyText = copySensitiveText,
  groupId,
  groupName,
  invitationService,
  isOwner,
  onBack,
  onPendingCountsChanged,
}: GroupInvitationScreenProps) => {
  const service = useMemo(
    () => invitationService ?? getGroupInvitationService(),
    [invitationService],
  );
  const [invitation, setInvitation] = useState<GroupInvitation>();
  const [issueError, setIssueError] = useState<string>();
  const [copyMessage, setCopyMessage] = useState<string>();
  const [isIssuing, setIsIssuing] = useState(false);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [joinRequestError, setJoinRequestError] = useState<string>();
  const [isLoadingRequests, setIsLoadingRequests] = useState(isOwner);
  const [requestReloadKey, setRequestReloadKey] = useState(0);
  const [processingRequestId, setProcessingRequestId] = useState<string>();
  const mountedRef = useRef(true);
  const issueInProgressRef = useRef(false);
  const resolvingRequestIdsRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOwner) {
      return;
    }

    let cancelled = false;

    const loadJoinRequests = async () => {
      setIsLoadingRequests(true);
      setJoinRequestError(undefined);
      const result = await service.listJoinRequests(groupId);

      if (cancelled) {
        return;
      }

      if (result.ok) {
        setJoinRequests(result.requests);
      } else {
        setJoinRequestError(result.error.message);
      }
      setIsLoadingRequests(false);
    };

    void loadJoinRequests();

    return () => {
      cancelled = true;
    };
  }, [groupId, isOwner, requestReloadKey, service]);

  const issueInvitation = async () => {
    if (issueInProgressRef.current) {
      return;
    }

    issueInProgressRef.current = true;
    setIsIssuing(true);
    setIssueError(undefined);
    setCopyMessage(undefined);

    try {
      const result = await service.createInvitation(groupId);

      if (!mountedRef.current) {
        return;
      }

      if (result.ok) {
        setInvitation(result.invitation);
      } else {
        setIssueError(result.error.message);
      }
    } finally {
      issueInProgressRef.current = false;
      if (mountedRef.current) {
        setIsIssuing(false);
      }
    }
  };

  const copyInvitation = async () => {
    if (!invitation) {
      return;
    }

    setCopyMessage(undefined);

    try {
      const copied = await copyText(invitation.token);
      if (!mountedRef.current) {
        return;
      }
      setCopyMessage(
        copied
          ? 'コピーしました'
          : 'コピーに失敗しました。もう一度お試しください。',
      );
    } catch {
      if (mountedRef.current) {
        setCopyMessage('コピーに失敗しました。もう一度お試しください。');
      }
    }
  };

  const resolveJoinRequest = async (requestId: string, approve: boolean) => {
    if (resolvingRequestIdsRef.current.has(requestId)) {
      return;
    }

    resolvingRequestIdsRef.current.add(requestId);
    setProcessingRequestId(requestId);
    setJoinRequestError(undefined);

    try {
      const result = await service.resolveJoinRequest(requestId, approve);

      if (!mountedRef.current) {
        return;
      }

      if (result.ok) {
        setJoinRequests((current) =>
          current.filter((request) => request.requestId !== requestId),
        );
        onPendingCountsChanged?.();
      } else {
        setJoinRequestError(result.error.message);
      }
    } finally {
      resolvingRequestIdsRef.current.delete(requestId);
      if (mountedRef.current) {
        setProcessingRequestId((current) =>
          current === requestId ? undefined : current,
        );
      }
    }
  };

  return (
    <SafeAreaView accessibilityLabel="招待管理画面" style={styles.screen}>
      <View style={styles.navigationBar}>
        <Pressable
          accessibilityLabel="グループ詳細に戻る"
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
        <Text style={styles.navigationTitle}>INVITATION</Text>
        <View style={styles.navigationSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.memoryMark}>
            <View style={styles.memoryOuterRing} />
            <View style={styles.memoryInnerRing} />
            <View style={styles.memoryCore} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            メンバーを招待
          </Text>
          <Text style={styles.groupName}>{groupName}</Text>
        </View>

        <View style={styles.invitationCard}>
          <Text style={styles.cardEyebrow}>ONE-TIME INVITATION</Text>
          <Text style={styles.cardTitle}>10分間だけ使える招待コード</Text>
          <Text style={styles.cardDescription}>
            コードは1人が使用すると無効になります。招待したい相手にだけ共有してください。
          </Text>

          {invitation ? (
            <View style={styles.codeArea}>
              <Text
                accessibilityLabel="招待コード"
                selectable
                style={styles.codeText}
              >
                {formatToken(invitation.token)}
              </Text>
              <Text style={styles.expiryText}>
                有効期限：{formatExpiry(invitation.expiresAt)}
              </Text>
              <View style={styles.approvalNotice}>
                <Ionicons
                  color="#9B5D10"
                  name={
                    invitation.requiresApproval
                      ? 'time-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={20}
                />
                <Text style={styles.approvalText}>
                  {invitation.requiresApproval
                    ? '参加にはオーナーの承認が必要です'
                    : 'このコードではすぐにグループへ参加できます'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="招待コードをコピー"
                accessibilityRole="button"
                onPress={() => {
                  void copyInvitation();
                }}
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed && styles.copyButtonPressed,
                ]}
              >
                <Ionicons color="#FFFFFF" name="copy-outline" size={18} />
                <Text style={styles.copyButtonText}>コードをコピー</Text>
              </Pressable>
              {copyMessage ? (
                <Text
                  accessibilityRole={
                    copyMessage === 'コピーしました' ? 'text' : 'alert'
                  }
                  style={
                    copyMessage === 'コピーしました'
                      ? styles.copySuccess
                      : styles.errorText
                  }
                >
                  {copyMessage}
                </Text>
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityLabel="招待コードを発行"
              accessibilityRole="button"
              accessibilityState={{ disabled: isIssuing }}
              disabled={isIssuing}
              onPress={() => {
                void issueInvitation();
              }}
              style={({ pressed }) => [
                styles.issueButton,
                pressed && !isIssuing && styles.issueButtonPressed,
                isIssuing && styles.buttonDisabled,
              ]}
            >
              {isIssuing ? (
                <ActivityIndicator
                  accessibilityLabel="招待コード発行中"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons color="#FFFFFF" name="key-outline" size={19} />
                  <Text style={styles.issueButtonText}>招待コードを発行</Text>
                </>
              )}
            </Pressable>
          )}

          {issueError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {issueError}
            </Text>
          ) : null}
        </View>

        {isOwner ? (
          <View style={styles.ownerSection}>
            <Text style={styles.sectionTitle}>参加申請</Text>
            <Text style={styles.sectionDescription}>
              メンバーが発行したコードから届いた申請です。
            </Text>

            {isLoadingRequests ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#E7A84B" size="small" />
                <Text style={styles.placeholderText}>
                  申請を読み込んでいます
                </Text>
              </View>
            ) : joinRequestError ? (
              <View style={styles.requestMessageCard}>
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {joinRequestError}
                </Text>
                <Pressable
                  accessibilityLabel="参加申請を再読み込み"
                  accessibilityRole="button"
                  onPress={() => {
                    setRequestReloadKey((current) => current + 1);
                  }}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.retryButtonPressed,
                  ]}
                >
                  <Text style={styles.retryButtonText}>再読み込み</Text>
                </Pressable>
              </View>
            ) : joinRequests.length === 0 ? (
              <View style={styles.requestMessageCard}>
                <Text style={styles.emptyText}>承認待ちの申請はありません</Text>
              </View>
            ) : (
              joinRequests.map((request) => {
                const applicantLabel = formatApplicantId(request.applicantId);
                const isProcessing = processingRequestId === request.requestId;

                return (
                  <View key={request.requestId} style={styles.requestCard}>
                    <View style={styles.requestIdentity}>
                      <View style={styles.requestAvatar}>
                        <Ionicons color="#D68B21" name="person" size={18} />
                      </View>
                      <Text style={styles.applicantText}>{applicantLabel}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable
                        accessibilityLabel={`${applicantLabel}の参加を拒否`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isProcessing }}
                        disabled={isProcessing}
                        onPress={() => {
                          void resolveJoinRequest(request.requestId, false);
                        }}
                        style={({ pressed }) => [
                          styles.rejectButton,
                          pressed &&
                            !isProcessing &&
                            styles.rejectButtonPressed,
                          isProcessing && styles.buttonDisabled,
                        ]}
                      >
                        <Text style={styles.rejectButtonText}>拒否</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${applicantLabel}の参加を許可`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isProcessing }}
                        disabled={isProcessing}
                        onPress={() => {
                          void resolveJoinRequest(request.requestId, true);
                        }}
                        style={({ pressed }) => [
                          styles.approveButton,
                          pressed &&
                            !isProcessing &&
                            styles.approveButtonPressed,
                          isProcessing && styles.buttonDisabled,
                        ]}
                      >
                        {isProcessing ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.approveButtonText}>許可</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  memoryMark: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'center',
    width: 66,
  },
  memoryOuterRing: {
    borderColor: '#D69332',
    borderRadius: 31,
    borderWidth: 1.5,
    height: 62,
    opacity: 0.35,
    position: 'absolute',
    width: 62,
  },
  memoryInnerRing: {
    borderColor: '#E7A84B',
    borderRadius: 21,
    borderWidth: 1.5,
    height: 42,
    opacity: 0.65,
    position: 'absolute',
    width: 42,
  },
  memoryCore: {
    backgroundColor: '#FFD084',
    borderColor: '#FFF2D5',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', marginTop: 10 },
  groupName: { color: '#AFC2CF', fontSize: 14, marginTop: 7 },
  invitationCard: {
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  cardEyebrow: {
    color: '#B26D18',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  cardTitle: {
    color: '#163344',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  cardDescription: {
    color: '#657984',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  codeArea: { marginTop: 22 },
  codeText: {
    backgroundColor: '#E8EFF2',
    borderColor: '#C8D6DC',
    borderRadius: 14,
    borderWidth: 1,
    color: '#163344',
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 23,
    padding: 16,
  },
  expiryText: { color: '#6F818B', fontSize: 12, marginTop: 10 },
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
  issueButton: {
    alignItems: 'center',
    backgroundColor: '#D68B21',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
  },
  issueButtonPressed: { backgroundColor: '#BD7415' },
  issueButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  copyButton: {
    alignItems: 'center',
    backgroundColor: '#173E53',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
  },
  copyButtonPressed: { backgroundColor: '#0D2E40' },
  copyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  copySuccess: {
    color: '#28704D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#9C342C',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
    textAlign: 'center',
  },
  ownerSection: { marginTop: 26 },
  sectionTitle: { color: '#F6F9FA', fontSize: 16, fontWeight: '800' },
  sectionDescription: {
    color: '#AFC2CF',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  placeholderText: { color: '#AFC2CF', fontSize: 13, marginTop: 10 },
  requestMessageCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 16,
    marginTop: 14,
    padding: 18,
  },
  emptyText: { color: '#657984', fontSize: 13 },
  retryButton: {
    backgroundColor: '#173E53',
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonPressed: { backgroundColor: '#0D2E40' },
  retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  requestCard: {
    backgroundColor: '#F6F9FA',
    borderRadius: 16,
    marginTop: 12,
    padding: 16,
  },
  requestIdentity: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  requestAvatar: {
    alignItems: 'center',
    backgroundColor: '#FFF0D8',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  applicantText: { color: '#163344', flex: 1, fontSize: 13, fontWeight: '700' },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectButton: {
    alignItems: 'center',
    borderColor: '#C8D6DC',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  rejectButtonPressed: { backgroundColor: '#E8EFF2' },
  rejectButtonText: { color: '#526A77', fontSize: 13, fontWeight: '800' },
  approveButton: {
    alignItems: 'center',
    backgroundColor: '#D68B21',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  approveButtonPressed: { backgroundColor: '#BD7415' },
  approveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
