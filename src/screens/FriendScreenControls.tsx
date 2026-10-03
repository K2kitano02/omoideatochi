import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FriendConfirmation } from '../features/friends/useFriendsScreen';

type FriendButtonProps = {
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
  onPress: () => void;
};

export const FriendButton = ({
  label,
  accessibilityLabel = label,
  disabled = false,
  danger = false,
  secondary = false,
  onPress,
}: FriendButtonProps) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      secondary && styles.secondary,
      danger && styles.danger,
      pressed && styles.pressed,
      disabled && styles.disabled,
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        secondary && styles.secondaryText,
        danger && styles.dangerText,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

export const FriendConfirmationModal = ({
  action,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  action: FriendConfirmation;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const regenerate = action.type === 'regenerate';
  return (
    <Modal animationType="fade" transparent visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          accessibilityLabel={
            regenerate ? 'コード再生成の確認' : 'フレンド解除の確認'
          }
          style={styles.modal}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {regenerate
              ? 'コードを再生成しますか？'
              : 'フレンドを解除しますか？'}
          </Text>
          <Text style={styles.description}>
            {regenerate
              ? '再生成すると古いコードは使えなくなります。フレンド関係や送信済みの申請は変わりません。'
              : `「${action.friend.user.displayName}」とのフレンドを解除します。お互いの個人投稿はコレクションから見られなくなります。グループへの所属は変わりません。`}
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {busy ? <Text style={styles.description}>処理中…</Text> : null}
          <View style={styles.actions}>
            <FriendButton
              label="キャンセル"
              secondary
              disabled={busy}
              onPress={onCancel}
            />
            <FriendButton
              label={regenerate ? '再生成する' : '解除する'}
              danger={!regenerate}
              disabled={busy}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#C98727',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondary: { backgroundColor: '#E8EFF2' },
  secondaryText: { color: '#173545' },
  danger: { backgroundColor: '#FBE4E1' },
  dangerText: { color: '#9C342C' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(4, 18, 28, 0.78)',
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    backgroundColor: '#F6F9FA',
    borderRadius: 22,
    gap: 16,
  },
  title: { color: '#173545', fontSize: 20, fontWeight: '800' },
  description: { color: '#5F737E', fontSize: 14, lineHeight: 22 },
  actions: { gap: 10 },
  error: { color: '#9C342C', fontSize: 14, lineHeight: 22 },
});
