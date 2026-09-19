import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import type { GroupsStackParamList } from './types';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

type GroupsListRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'GroupsList'
>;

const GroupsListRoute = ({ navigation }: GroupsListRouteProps) => (
  <GroupsScreen
    onSelectGroup={(groupId) => {
      navigation.navigate('GroupDetails', { groupId });
    }}
  />
);

type GroupDetailsRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'GroupDetails'
>;

const GroupDetailsRoute = ({ navigation, route }: GroupDetailsRouteProps) => (
  <GroupDetailScreen
    groupId={route.params.groupId}
    onBack={() => navigation.goBack()}
  />
);

export const GroupsNavigator = () => (
  <Stack.Navigator
    initialRouteName="GroupsList"
    screenOptions={{
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: '#0B2638' },
      headerShown: false,
    }}
  >
    <Stack.Screen component={GroupsListRoute} name="GroupsList" />
    <Stack.Screen component={GroupDetailsRoute} name="GroupDetails" />
  </Stack.Navigator>
);
