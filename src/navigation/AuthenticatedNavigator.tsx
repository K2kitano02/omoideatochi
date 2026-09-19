import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';

import type { AuthSessionUser } from '../features/auth/useAuthSession';
import { CollectionScreen } from '../screens/CollectionScreen';
import { MapScreen } from '../screens/MapScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GroupsNavigator } from './GroupsNavigator';
import type { AuthenticatedTabParamList } from './types';

type AuthenticatedNavigatorProps = {
  user: AuthSessionUser;
  error: string | null;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
};

const Tab = createBottomTabNavigator<AuthenticatedTabParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B2638',
    border: '#244354',
    card: '#102F42',
    primary: '#E7A84B',
    text: '#F6F9FA',
  },
};

const tabIcons: Record<
  keyof AuthenticatedTabParamList,
  {
    focused: keyof typeof Ionicons.glyphMap;
    unfocused: keyof typeof Ionicons.glyphMap;
  }
> = {
  Map: { focused: 'map', unfocused: 'map-outline' },
  Groups: { focused: 'people', unfocused: 'people-outline' },
  Collection: { focused: 'albums', unfocused: 'albums-outline' },
  Settings: { focused: 'settings', unfocused: 'settings-outline' },
};

export const AuthenticatedNavigator = ({
  user,
  error,
  isSigningOut,
  onSignOut,
}: AuthenticatedNavigatorProps) => (
  <NavigationContainer theme={navigationTheme}>
    <Tab.Navigator
      initialRouteName="Map"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarAccessibilityLabel: `${getTabLabel(route.name)}タブ`,
        tabBarActiveTintColor: '#E7A84B',
        tabBarInactiveTintColor: '#91A7B4',
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            color={color}
            name={
              focused
                ? tabIcons[route.name].focused
                : tabIcons[route.name].unfocused
            }
            size={size}
          />
        ),
        tabBarLabel: getTabLabel(route.name),
        tabBarStyle: {
          backgroundColor: '#102F42',
          borderTopColor: '#244354',
          height: 82,
          paddingBottom: 12,
          paddingTop: 8,
        },
      })}
    >
      <Tab.Screen component={MapScreen} name="Map" />
      <Tab.Screen component={GroupsNavigator} name="Groups" />
      <Tab.Screen component={CollectionScreen} name="Collection" />
      <Tab.Screen name="Settings">
        {() => (
          <SettingsScreen
            error={error}
            isSigningOut={isSigningOut}
            onSignOut={onSignOut}
            user={user}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  </NavigationContainer>
);

const getTabLabel = (routeName: keyof AuthenticatedTabParamList) => {
  const labels: Record<keyof AuthenticatedTabParamList, string> = {
    Map: '地図',
    Groups: 'グループ',
    Collection: 'コレクション',
    Settings: '設定',
  };

  return labels[routeName];
};
