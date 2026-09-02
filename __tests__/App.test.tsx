import { render, screen } from '@testing-library/react-native';

import App from '../App';

describe('<App />', () => {
  test('初期画面にアプリ名を表示する', async () => {
    await render(<App />);

    expect(screen.getByText('思い出跡地')).toBeTruthy();
  });
});
