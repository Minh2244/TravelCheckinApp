import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>TravelCheckin</Text>
        <Text style={styles.subtitle}>Khám phá du lịch Việt Nam</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>🏠 Home Screen</Text>
          <Text style={styles.cardSubtext}>Giai đoạn 1 - Scaffold</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdfa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#14b8a6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
});
