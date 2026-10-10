import type { ExpoConfig } from 'expo/config';

import { expo } from './app.json';
import { createGoogleMapsConfig } from './config/googleMapsConfig.ts';

export default createGoogleMapsConfig(expo as ExpoConfig, {
  ios: process.env.GOOGLE_MAPS_IOS_API_KEY,
  android: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
});
