export type AuthenticatedTabParamList = {
  Map: undefined;
  Groups: undefined;
  Friends: undefined;
  Collection: undefined;
  Settings: undefined;
};

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDetails: { groupId: string };
  GroupInvitation: {
    groupId: string;
    groupName: string;
    isOwner: boolean;
  };
  JoinGroup: undefined;
};
