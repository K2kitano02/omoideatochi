import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendService } from '../features/friends/friends';
import type { FriendService } from '../features/friends/friendService';
import { useFriendsScreen } from '../features/friends/useFriendsScreen';
import { FriendButton, FriendConfirmationModal } from './FriendScreenControls';

export type FriendsScreenProps = {
  friendService?: FriendService;
  copyText?: (text: string) => Promise<boolean>;
  isFocused?: boolean;
};

const copyCode = (code: string) => Clipboard.setStringAsync(code);

export const FriendsScreen = ({
  isFocused = true,
  ...props
}: FriendsScreenProps) =>
  isFocused ? <FriendsScreenContent {...props} /> : null;

const FriendsScreenContent = ({
  friendService,
  copyText = copyCode,
}: FriendsScreenProps) => {
  const service = useMemo(
    () => friendService ?? getFriendService(),
    [friendService],
  );
  const state = useFriendsScreen(service, copyText);

  return (
    <SafeAreaView accessibilityLabel="フレンド画面" style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>MEMORY FRIENDS</Text>
          <Text accessibilityRole="header" style={styles.title}>
            フレンド
          </Text>
          <Text style={styles.intro}>
            コードでつながり、友達の思い出を街で拾う。
          </Text>
          <FriendButton
            label="再読み込み"
            secondary
            disabled={state.disabled}
            onPress={state.refresh}
          />
          {state.loading ? (
            <View
              accessibilityLabel="フレンド情報を読み込み中"
              accessibilityRole="progressbar"
              style={styles.loading}
            >
              <ActivityIndicator color="#E7A84B" />
              <Text style={styles.intro}>読み込み中…</Text>
            </View>
          ) : null}
          {state.busy ? (
            <Text
              accessibilityRole="progressbar"
              accessibilityLabel="フレンド操作を処理中"
              style={styles.intro}
            >
              処理中…
            </Text>
          ) : null}
          {state.feedback ? (
            <Text accessibilityRole="alert" style={styles.feedback}>
              {state.feedback}
            </Text>
          ) : null}
          {state.error ? (
            <Text accessibilityRole="alert" style={styles.errorBanner}>
              {state.error}
            </Text>
          ) : null}

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              自分のフレンドコード
            </Text>
            <Text style={styles.description}>
              追加してほしい相手に、このコードを共有してください。
            </Text>
            {state.lists.errors.code ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {state.lists.errors.code}
              </Text>
            ) : null}
            {state.code ? (
              <Text style={styles.code}>{state.code}</Text>
            ) : (
              <Text style={styles.description}>
                コードは再読み込みで確認できます。
              </Text>
            )}
            <FriendButton
              label="コードをコピー"
              accessibilityLabel="自分のコードをコピー"
              disabled={state.disabled || !state.code}
              onPress={() => void state.copyCode()}
            />
            <FriendButton
              label="コードを再生成"
              secondary
              disabled={state.disabled || !state.code}
              onPress={() => state.openConfirmation({ type: 'regenerate' })}
            />
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              フレンド申請を送る
            </Text>
            <Text style={styles.description}>
              相手のコードを入力し、名前を確認してから申請します。
            </Text>
            <TextInput
              accessibilityLabel="相手のフレンドコード"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!state.busy && !state.loading}
              onChangeText={state.changeInput}
              placeholder="16文字のコード"
              placeholderTextColor="#81939E"
              returnKeyType="done"
              style={styles.input}
              value={state.input}
            />
            <FriendButton
              label={state.checking ? '確認中…' : '相手を確認'}
              accessibilityLabel="相手を確認"
              disabled={state.disabled}
              onPress={() => void state.checkCode()}
            />
            {state.preview ? (
              <View style={styles.preview}>
                <Text style={styles.description}>申請する相手</Text>
                <Text style={styles.name}>
                  {state.preview.user.displayName}
                </Text>
                <Text style={styles.description}>
                  相手が承認するとフレンドになります。
                </Text>
                <FriendButton
                  label="申請を送る"
                  disabled={state.disabled}
                  onPress={() => void state.sendRequest()}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              受信した申請
            </Text>
            {state.lists.errors.received ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {state.lists.errors.received}
              </Text>
            ) : !state.loading && state.lists.received.length === 0 ? (
              <Text style={styles.description}>受信した申請はありません</Text>
            ) : null}
            {state.lists.received.map((request) => (
              <View key={request.requestId} style={styles.listItem}>
                <Text style={styles.name}>{request.user.displayName}</Text>
                <View style={styles.actions}>
                  <FriendButton
                    label="承認"
                    accessibilityLabel={`${request.user.displayName}の申請を承認`}
                    disabled={state.disabled}
                    onPress={() =>
                      void state.resolveRequest(request.requestId, true)
                    }
                  />
                  <FriendButton
                    label="拒否"
                    secondary
                    accessibilityLabel={`${request.user.displayName}の申請を拒否`}
                    disabled={state.disabled}
                    onPress={() =>
                      void state.resolveRequest(request.requestId, false)
                    }
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              送信済みの申請
            </Text>
            {state.lists.errors.sent ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {state.lists.errors.sent}
              </Text>
            ) : !state.loading && state.lists.sent.length === 0 ? (
              <Text style={styles.description}>送信済みの申請はありません</Text>
            ) : null}
            {state.lists.sent.map((request) => (
              <View key={request.requestId} style={styles.listItem}>
                <Text style={styles.name}>{request.user.displayName}</Text>
                <Text style={styles.pending}>申請中</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              フレンド一覧
            </Text>
            <Text style={styles.description}>
              グループのメンバーは自動では追加されません。
            </Text>
            {state.lists.errors.friends ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {state.lists.errors.friends}
              </Text>
            ) : !state.loading && state.lists.friends.length === 0 ? (
              <Text style={styles.description}>まだフレンドはいません</Text>
            ) : null}
            {state.lists.friends.map((friend) => (
              <View key={friend.relationshipId} style={styles.listItem}>
                <Text style={styles.name}>{friend.user.displayName}</Text>
                <FriendButton
                  label="フレンドを解除"
                  danger
                  accessibilityLabel={`${friend.user.displayName}とのフレンドを解除`}
                  disabled={state.disabled}
                  onPress={() =>
                    state.openConfirmation({ type: 'remove', friend })
                  }
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {state.confirmation ? (
        <FriendConfirmationModal
          action={state.confirmation}
          busy={state.busy}
          error={state.confirmationError}
          onCancel={state.cancelConfirmation}
          onConfirm={() => void state.confirm()}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B2638' },
  content: { padding: 22, paddingBottom: 36, gap: 16 },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: { color: '#F6F9FA', fontSize: 30, fontWeight: '800' },
  intro: { color: '#91A7B4', fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: '#F6F9FA', padding: 20, borderRadius: 22, gap: 12 },
  heading: { color: '#173545', fontSize: 19, fontWeight: '800' },
  description: { color: '#5F737E', fontSize: 14, lineHeight: 22 },
  code: {
    color: '#173545',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C7D4DA',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 50,
    padding: 14,
    color: '#173545',
    fontSize: 16,
  },
  preview: {
    backgroundColor: '#E8EFF2',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  listItem: {
    borderTopWidth: 1,
    borderTopColor: '#DCE5E9',
    paddingTop: 14,
    gap: 10,
  },
  name: { color: '#173545', fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pending: { color: '#9B631B', fontSize: 13, fontWeight: '700' },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  feedback: {
    backgroundColor: '#E6F2EB',
    color: '#276047',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: '#FBE4E1',
    color: '#9C342C',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  error: { color: '#9C342C', fontSize: 14, lineHeight: 22 },
});
