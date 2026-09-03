import { registerRootComponent } from 'expo';

import App from './App';
import { getEnv } from './src/config/env';

getEnv();

registerRootComponent(App);
