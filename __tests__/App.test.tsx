import { render, screen } from '@testing-library/react-native';

import App from '../App';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

describe('<App />', () => {
  test('初期画面にログインフォームを表示する', async () => {
    await render(<App />);

    expect(screen.getByText('思い出跡地')).toBeTruthy();
    expect(screen.getByLabelText('メールアドレス')).toBeTruthy();
    expect(screen.getByLabelText('パスワード')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeTruthy();
  });
});
