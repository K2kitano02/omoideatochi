import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const CollectionScreen = () => (
  <SafeAreaView accessibilityLabel="コレクション画面" style={styles.screen}>
    <Text style={styles.eyebrow}>FOUND MEMORIES</Text>
    <Text accessibilityRole="header" style={styles.title}>
      コレクション
    </Text>
    <Text style={styles.description}>
      街で拾ったフレンドの思い出を、あとから見返す場所です。
    </Text>

    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons color="#E7A84B" name="albums-outline" size={34} />
      </View>
      <Text style={styles.cardTitle}>まだ思い出はありません</Text>
      <Text style={styles.cardText}>
        コレクション機能は、フレンドの思い出を発見する機能と一緒に追加します。
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
