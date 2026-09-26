import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { SettingsScreen } from './SettingsScreen';

describe('<SettingsScreen />', () => {
  test('現在の表示名を変更して保存できる', async () => {
    const onSaveDisplayName = jest.fn().mockResolvedValue({ ok: true });

    await render(
      <SettingsScreen
        displayName="なおき"
        error={null}
        isSigningOut={false}
        onSaveDisplayName={onSaveDisplayName}
        onSignOut={jest.fn()}
        user={{ id: 'user-id', email: 'user@example.com' }}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('表示名'), 'ナオキ');
    await fireEvent.press(screen.getByRole('button', { name: '表示名を保存' }));

    await waitFor(() =>
      expect(onSaveDisplayName).toHaveBeenCalledWith('ナオキ'),
    );
    expect(screen.getByText('表示名を更新しました。')).toBeTruthy();
  });

  test('保存失敗時は理由を表示して入力内容を保つ', async () => {
    const onSaveDisplayName = jest.fn().mockResolvedValue({
      ok: false,
      error: {
        type: 'network',
        message: '通信に失敗しました。接続を確認して再度お試しください。',
      },
    });

    await render(
      <SettingsScreen
        displayName="なおき"
        error={null}
        isSigningOut={false}
        onSaveDisplayName={onSaveDisplayName}
        onSignOut={jest.fn()}
        user={{ id: 'user-id', email: 'user@example.com' }}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('表示名'), 'ナオキ');
    await fireEvent.press(screen.getByRole('button', { name: '表示名を保存' }));

    expect(
      await screen.findByText(
        '通信に失敗しました。接続を確認して再度お試しください。',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('表示名').props.value).toBe('ナオキ');
  });
});
