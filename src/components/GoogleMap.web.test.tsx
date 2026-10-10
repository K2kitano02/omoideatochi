import { render, screen } from '@testing-library/react-native';

import { GoogleMap } from './GoogleMap.web';

it('Webではネイティブ地図ではなく非対応の案内を表示する', async () => {
  await render(<GoogleMap />);
  expect(screen.getByText(/iOS・Androidの開発ビルド/)).toBeOnTheScreen();
  expect(screen.queryByLabelText('Google Maps')).toBeNull();
});
