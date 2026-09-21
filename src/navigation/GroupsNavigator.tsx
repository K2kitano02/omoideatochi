import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { GroupInvitationScreen } from '../screens/GroupInvitationScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';
import type { GroupsStackParamList } from './types';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

type GroupsListRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'GroupsList'
> & {
  onRefreshPendingCounts: () => Promise<void>;
  pendingCounts: Readonly<Record<string, number>>;
};

const GroupsListRoute = ({
  navigation,
  onRefreshPendingCounts,
  pendingCounts,
}: GroupsListRouteProps) => {
  useFocusEffect(
    useCallback(() => {
      void onRefreshPendingCounts();
    }, [onRefreshPendingCounts]),
  );

  return (
    <GroupsScreen
      onJoinByCode={() => {
        navigation.navigate('JoinGroup');
      }}
      onSelectGroup={(groupId) => {
        navigation.navigate('GroupDetails', { groupId });
      }}
      pendingCounts={pendingCounts}
    />
  );
};

type GroupDetailsRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'GroupDetails'
> & { currentUserId: string };

const GroupDetailsRoute = ({
  currentUserId,
  navigation,
  pendingCounts,
  route,
}: GroupDetailsRouteProps & {
  pendingCounts: Readonly<Record<string, number>>;
}) => (
  <GroupDetailScreen
    currentUserId={currentUserId}
    groupId={route.params.groupId}
    onBack={() => navigation.goBack()}
    onInvite={(params) => {
      navigation.navigate('GroupInvitation', params);
    }}
    pendingCount={pendingCounts[route.params.groupId] ?? 0}
  />
);

type GroupInvitationRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'GroupInvitation'
>;

const GroupInvitationRoute = ({
  navigation,
  onRefreshPendingCounts,
  route,
}: GroupInvitationRouteProps & {
  onRefreshPendingCounts: () => Promise<void>;
}) => (
  <GroupInvitationScreen
    groupId={route.params.groupId}
    groupName={route.params.groupName}
    isOwner={route.params.isOwner}
    onBack={() => navigation.goBack()}
    onPendingCountsChanged={() => {
      void onRefreshPendingCounts();
    }}
  />
);

type JoinGroupRouteProps = NativeStackScreenProps<
  GroupsStackParamList,
  'JoinGroup'
>;

const JoinGroupRoute = ({ navigation }: JoinGroupRouteProps) => (
  <JoinGroupScreen
    onBack={() => navigation.goBack()}
    onJoined={(groupId) => {
      navigation.replace('GroupDetails', { groupId });
    }}
  />
);

type GroupsNavigatorProps = {
  currentUserId: string;
  onRefreshPendingCounts: () => Promise<void>;
  pendingCounts: Readonly<Record<string, number>>;
};

export const GroupsNavigator = ({
  currentUserId,
  onRefreshPendingCounts,
  pendingCounts,
}: GroupsNavigatorProps) => (
  <Stack.Navigator
    initialRouteName="GroupsList"
    screenOptions={{
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: '#0B2638' },
      headerShown: false,
    }}
  >
    <Stack.Screen name="GroupsList">
      {(props) => (
        <GroupsListRoute
          {...props}
          onRefreshPendingCounts={onRefreshPendingCounts}
          pendingCounts={pendingCounts}
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="GroupDetails">
      {(props) => (
        <GroupDetailsRoute
          {...props}
          currentUserId={currentUserId}
          pendingCounts={pendingCounts}
        />
      )}
    </Stack.Screen>
    <Stack.Screen name="GroupInvitation">
      {(props) => (
        <GroupInvitationRoute
          {...props}
          onRefreshPendingCounts={onRefreshPendingCounts}
        />
      )}
    </Stack.Screen>
    <Stack.Screen component={JoinGroupRoute} name="JoinGroup" />
  </Stack.Navigator>
);
