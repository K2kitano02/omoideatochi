import { StatusBar } from 'expo-status-bar';

import { AuthScreen } from './src/screens/AuthScreen';

export default function App() {
  return (
    <>
      <AuthScreen />
      <StatusBar style="light" />
    </>
  );
}
