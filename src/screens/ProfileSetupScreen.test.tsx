import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import type { ProfileService } from '../features/profile/profileService';
import { ProfileSetupScreen } from './ProfileSetupScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

describe('<ProfileSetupScreen />', () => {
  test('既存ユーザーが表示名を設定してアプリを開始できる', async () => {
    const saveDisplayName = jest.fn().mockResolvedValue({
      ok: true,
      profile: { userId: 'user-id', displayName: 'なおき' },
    });
    const onSaved = jest.fn();

    await render(
      <ProfileSetupScreen
        onSaved={onSaved}
        profileService={
          { saveDisplayName } as Pick<ProfileService, 'saveDisplayName'>
        }
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('表示名'), 'なおき');
    await fireEvent.press(
      screen.getByRole('button', { name: '表示名を設定する' }),
    );

    await waitFor(() => expect(saveDisplayName).toHaveBeenCalledWith('なおき'));
    expect(onSaved).toHaveBeenCalledWith({
      userId: 'user-id',
      displayName: 'なおき',
    });
  });

  test('16文字以上の表示名を保存せず理由を表示する', async () => {
    const saveDisplayName = jest.fn();

    await render(
      <ProfileSetupScreen
        onSaved={jest.fn()}
        profileService={
          { saveDisplayName } as Pick<ProfileService, 'saveDisplayName'>
        }
      />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('表示名'),
      '1234567890123456',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: '表示名を設定する' }),
    );

    expect(saveDisplayName).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        '表示名は前後に空白を入れず、1〜15文字で入力してください。',
      ),
    ).toBeTruthy();
  });
});
