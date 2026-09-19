import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const GroupsScreen = () => (
  <SafeAreaView accessibilityLabel="グループ画面" style={styles.screen}>
    <Text style={styles.eyebrow}>SHARED MEMORIES</Text>
    <Text accessibilityRole="header" style={styles.title}>
      グループ
    </Text>
    <Text style={styles.description}>
      大切な人と共有する思い出を、グループごとに振り返れます。
    </Text>

    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons color="#E7A84B" name="people-outline" size={34} />
      </View>
      <Text style={styles.cardTitle}>グループ機能は準備中です</Text>
      <Text style={styles.cardText}>
        次のIssueで、所属グループの一覧と作成機能を追加します。
      </Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  eyebrow: {
    color: '#E7A84B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 24,
    marginTop: 34,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#FFF2DC',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  cardTitle: {
    color: '#102B3D',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
  },
  cardText: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
});
