import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const MapScreen = () => (
  <SafeAreaView accessibilityLabel="地図画面" style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>MEMORY MAP</Text>
      <Text accessibilityRole="header" style={styles.title}>
        思い出の地図
      </Text>
      <Text style={styles.description}>
        自分が残した思い出を、ここからいつでも振り返れます。
      </Text>
    </View>

    <View style={styles.mapPlaceholder}>
      <View accessibilityElementsHidden style={styles.locationMark}>
        <View style={styles.ringOuter} />
        <View style={styles.ringInner} />
        <View style={styles.pin}>
          <Ionicons color="#0B2638" name="camera" size={20} />
        </View>
      </View>
      <Text style={styles.placeholderTitle}>
        地図は次のステップで追加します
      </Text>
      <Text style={styles.placeholderText}>
        今回は、各画面へ安全に移動するための土台を作っています。
      </Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0B2638',
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
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
    letterSpacing: 1,
    marginTop: 8,
  },
  description: {
    color: '#AFC2CF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  mapPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F6F9FA',
    borderRadius: 28,
    flex: 1,
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 28,
    paddingHorizontal: 30,
  },
  locationMark: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
    marginBottom: 26,
    width: 132,
  },
  ringOuter: {
    borderColor: 'rgba(231, 168, 75, 0.28)',
    borderRadius: 66,
    borderWidth: 2,
    height: 132,
    position: 'absolute',
    width: 132,
  },
  ringInner: {
    borderColor: 'rgba(231, 168, 75, 0.55)',
    borderRadius: 43,
    borderWidth: 2,
    height: 86,
    position: 'absolute',
    width: 86,
  },
  pin: {
    alignItems: 'center',
    backgroundColor: '#E7A84B',
    borderColor: '#FFE1A8',
    borderRadius: 25,
    borderWidth: 4,
    height: 50,
    justifyContent: 'center',
    shadowColor: '#E7A84B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    width: 50,
  },
  placeholderTitle: {
    color: '#102B3D',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderText: {
    color: '#596D79',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
});
