import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { Group, GroupService } from '../features/groups/groupService';
import { GroupsScreen } from './GroupsScreen';

jest.mock('expo-sqlite/localStorage/install', () => ({}));

const familyGroup: Group = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '家族',
  createdBy: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  createdAt: '2026-09-19T00:00:00.000Z',
};

const friendsGroup: Group = {
  id: '22222222-2222-2222-2222-222222222222',
  name: '学生時代の友達',
  createdBy: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  createdAt: '2026-09-18T00:00:00.000Z',
};

const createGroupService = (
  overrides: Partial<GroupService> = {},
): GroupService => ({
  createGroup: jest.fn().mockResolvedValue({
    ok: true,
    groupId: '33333333-3333-3333-3333-333333333333',
  }),
  listGroups: jest.fn().mockResolvedValue({ ok: true, groups: [] }),
  ...overrides,
});

describe('<GroupsScreen />', () => {
  test('所属グループ名と作成数を表示する', async () => {
    const groupService = createGroupService({
      listGroups: jest.fn().mockResolvedValue({
        ok: true,
        groups: [familyGroup, friendsGroup],
      }),
    });

    await render(<GroupsScreen groupService={groupService} />);

    expect(await screen.findByText('家族')).toBeTruthy();
    expect(screen.getByText('学生時代の友達')).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  test('所属グループがない場合は空状態と作成導線を表示する', async () => {
    await render(<GroupsScreen groupService={createGroupService()} />);

    expect(await screen.findByText('まだグループはありません')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '最初のグループを作る' }),
    ).toBeTruthy();
  });

  test('グループ作成画面を前面中央に表示する', async () => {
    await render(<GroupsScreen groupService={createGroupService()} />);
    await screen.findByText('まだグループはありません');

    await fireEvent.press(
      screen.getByRole('button', { name: '最初のグループを作る' }),
    );

    const modalHeading = screen.getByRole('header', {
      name: 'グループを作る',
    });
    const modalOverlay = modalHeading.parent?.parent?.parent?.parent;

    expect(StyleSheet.flatten(modalOverlay?.props.style)).toEqual(
      expect.objectContaining({ justifyContent: 'center' }),
    );
  });

  test.each([
    {
      name: '空欄',
      value: '',
      message: 'グループ名を入力してください',
    },
    {
      name: '前後に空白がある',
      value: ' 家族 ',
      message: 'グループ名の前後に空白は使用できません',
    },
    {
      name: '101文字',
      value: '思'.repeat(101),
      message: 'グループ名は100文字以内で入力してください',
    },
  ])(
    '$nameのグループ名は送信せず理由を表示する',
    async ({ value, message }) => {
      const createGroup = jest.fn().mockResolvedValue({
        ok: true,
        groupId: '33333333-3333-3333-3333-333333333333',
      });
      const groupService = createGroupService({ createGroup });

      await render(<GroupsScreen groupService={groupService} />);
      await screen.findByText('まだグループはありません');

      await fireEvent.press(
        screen.getByRole('button', { name: '最初のグループを作る' }),
      );
      if (value) {
        await fireEvent.changeText(screen.getByLabelText('グループ名'), value);
      }
      await fireEvent.press(
        screen.getByRole('button', { name: 'グループを作成' }),
      );

      expect(await screen.findByText(message)).toBeTruthy();
      expect(createGroup).not.toHaveBeenCalled();
    },
  );

  test('作成成功後にモーダルを閉じて最新の一覧を表示する', async () => {
    const listGroups = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, groups: [] })
      .mockResolvedValueOnce({ ok: true, groups: [familyGroup] });
    const groupService = createGroupService({ listGroups });

    await render(<GroupsScreen groupService={groupService} />);
    await screen.findByText('まだグループはありません');

    await fireEvent.press(
      screen.getByRole('button', { name: '最初のグループを作る' }),
    );
    await fireEvent.changeText(screen.getByLabelText('グループ名'), '家族');
    await fireEvent.press(
      screen.getByRole('button', { name: 'グループを作成' }),
    );

    expect(await screen.findByText('家族')).toBeTruthy();
    expect(screen.queryByLabelText('グループ名')).toBeNull();
  });

  test('作成エラーをモーダル内へ表示する', async () => {
    const groupService = createGroupService({
      createGroup: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          type: 'group-limit',
          message: '作成できるグループは5件までです。',
        },
      }),
    });

    await render(<GroupsScreen groupService={groupService} />);
    await screen.findByText('まだグループはありません');

    await fireEvent.press(
      screen.getByRole('button', { name: '最初のグループを作る' }),
    );
    await fireEvent.changeText(screen.getByLabelText('グループ名'), '6個目');
    await fireEvent.press(
      screen.getByRole('button', { name: 'グループを作成' }),
    );

    expect(
      await screen.findByText('作成できるグループは5件までです。'),
    ).toBeTruthy();
    expect(screen.getByLabelText('グループ名')).toBeTruthy();
  });

  test('一覧取得エラーから再読み込みできる', async () => {
    const listGroups = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          type: 'network',
          message: '通信に失敗しました。接続を確認して再度お試しください。',
        },
      })
      .mockResolvedValueOnce({ ok: true, groups: [familyGroup] });
    const groupService = createGroupService({ listGroups });

    await render(<GroupsScreen groupService={groupService} />);

    expect(
      await screen.findByText(
        '通信に失敗しました。接続を確認して再度お試しください。',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '再読み込み' }));

    expect(await screen.findByText('家族')).toBeTruthy();
  });

  test('作成中は多重送信を防ぐ', async () => {
    let resolveCreate!: (
      value: Awaited<ReturnType<GroupService['createGroup']>>,
    ) => void;
    const createGroup = jest.fn(
      () =>
        new Promise<Awaited<ReturnType<GroupService['createGroup']>>>(
          (resolve) => {
            resolveCreate = resolve;
          },
        ),
    );
    const groupService = createGroupService({ createGroup });

    await render(<GroupsScreen groupService={groupService} />);
    await screen.findByText('まだグループはありません');

    await fireEvent.press(
      screen.getByRole('button', { name: '最初のグループを作る' }),
    );
    await fireEvent.changeText(screen.getByLabelText('グループ名'), '家族');
    await fireEvent.press(
      screen.getByRole('button', { name: 'グループを作成' }),
    );

    const disabledButton = screen.getByRole('button', {
      name: 'グループを作成',
      disabled: true,
    });
    await fireEvent.press(disabledButton);

    expect(createGroup).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('グループ作成中')).toBeTruthy();

    await act(async () => {
      resolveCreate({
        ok: false,
        error: {
          type: 'network',
          message: '通信に失敗しました。接続を確認して再度お試しください。',
        },
      });
      await Promise.resolve();
    });
  });
});
