import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { GroupLifecycleFailureReason } from '../features/groups/groupLifecycleService';
import type { GroupMember } from '../features/groups/groupService';

export type PendingLifecycleAction =
  | { type: 'leave' }
  | { type: 'remove-member'; member: GroupMember }
  | { type: 'dissolve' };

export const DISSOLVE_CONFIRMATION_WORD = '解散';

const shortenUserId = (userId: string) =>
  `${userId.slice(0, 8)}…${userId.slice(-4)}`;

const lifecycleErrorMessages: Record<GroupLifecycleFailureReason, string> = {
  unauthenticated:
    'ログイン状態を確認できませんでした。再度ログインしてください。',
  'permission-denied': 'この操作を行う権限がありません。',
  'owner-cannot-leave':
    '作成者はグループから退出できません。グループを解散してください。',
  'owner-cannot-be-removed': 'グループの作成者は削除できません。',
  'group-not-found': 'このグループは見つかりませんでした。',
  'already-left': 'このグループからはすでに退出しています。',
  'member-not-found': '対象のメンバーはすでにグループにいません。',
  'group-dissolved': 'このグループはすでに解散しています。',
  network: '通信に失敗しました。接続を確認して再度お試しください。',
  unexpected: '操作に失敗しました。時間をおいて再度お試しください。',
};

export const getGroupLifecycleErrorMessage = (
  reason: GroupLifecycleFailureReason,
): string => lifecycleErrorMessages[reason];

type GroupLifecycleConfirmationModalProps = {
  action: PendingLifecycleAction;
  dissolveConfirmation: string;
  error?: string;
  groupName: string;
  isProcessing: boolean;
  onCancel: () => void;
  onChangeDissolveConfirmation: (value: string) => void;
  onConfirm: () => void;
};

export const GroupLifecycleConfirmationModal = ({
  action,
  dissolveConfirmation,
  error,
  groupName,
  isProcessing,
  onCancel,
  onChangeDissolveConfirmation,
  onConfirm,
}: GroupLifecycleConfirmationModalProps) => {
  const isDissolve = action.type === 'dissolve';
  const memberName =
    action.type === 'remove-member'
      ? (action.member.displayName ?? shortenUserId(action.member.userId))
      : undefined;
  const title =
    action.type === 'leave'
      ? 'グループを退出'
      : action.type === 'remove-member'
        ? 'メンバーを削除'
        : 'グループを解散';
  const description =
    action.type === 'leave'
      ? `「${groupName}」から退出しますか？`
      : action.type === 'remove-member'
        ? `${memberName}をグループから削除しますか？`
        : `「${groupName}」を解散すると、メンバー全員がアクセスできなくなります。`;
  const confirmLabel =
    action.type === 'leave'
      ? '退出する'
      : action.type === 'remove-member'
        ? '削除する'
        : '解散する';
  const isConfirmDisabled =
    isProcessing ||
    (isDissolve && dissolveConfirmation !== DISSOLVE_CONFIRMATION_WORD);
  const accessibilityLabel =
    action.type === 'leave'
      ? '退出の確認'
      : action.type === 'remove-member'
        ? 'メンバー削除の確認'
        : '解散の確認';

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          style={styles.modalCard}
        >
          <View style={styles.modalIcon}>
            <Ionicons color="#A5453E" name="warning-outline" size={25} />
          </View>
          <Text accessibilityRole="header" style={styles.modalTitle}>
            {title}
          </Text>
          <Text style={styles.modalDescription}>{description}</Text>

          {isDissolve ? (
            <View style={styles.confirmationField}>
              <Text style={styles.confirmationLabel}>
                確認のため「{DISSOLVE_CONFIRMATION_WORD}」と入力してください
              </Text>
              <TextInput
                accessibilityLabel="確認のため「解散」と入力"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isProcessing}
                onChangeText={onChangeDissolveConfirmation}
                placeholder={DISSOLVE_CONFIRMATION_WORD}
                placeholderTextColor="#8A9BA4"
                returnKeyType="done"
                style={styles.confirmationInput}
                value={dissolveConfirmation}
              />
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={styles.lifecycleError}>
              {error}
            </Text>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isProcessing }}
              disabled={isProcessing}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={isProcessing ? '処理中' : confirmLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: isConfirmDisabled }}
              disabled={isConfirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmDangerButton,
                isConfirmDisabled && styles.confirmDangerButtonDisabled,
                pressed && !isConfirmDisabled && styles.dangerButtonPressed,
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : null}
              <Text style={styles.confirmDangerButtonText}>
                {isProcessing ? '処理中…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(4, 18, 28, 0.78)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 22,
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingVertical: 24,
    width: '100%',
  },
  modalIcon: {
    alignItems: 'center',
    backgroundColor: '#FBE4E1',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  modalTitle: {
    color: '#173545',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  modalDescription: {
    color: '#5F737E',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'center',
  },
  confirmationField: {
    marginTop: 18,
    width: '100%',
  },
  confirmationLabel: {
    color: '#4D626D',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  confirmationInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D4DA',
    borderRadius: 12,
    borderWidth: 1,
    color: '#173545',
    fontSize: 15,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  lifecycleError: {
    color: '#9C342C',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#B8C7CE',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonPressed: {
    backgroundColor: '#E8EFF2',
  },
  cancelButtonText: {
    color: '#4C626E',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmDangerButton: {
    alignItems: 'center',
    backgroundColor: '#A5453E',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmDangerButtonDisabled: {
    backgroundColor: '#C8A4A1',
  },
  confirmDangerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dangerButtonPressed: {
    backgroundColor: '#F5DCD8',
  },
});
