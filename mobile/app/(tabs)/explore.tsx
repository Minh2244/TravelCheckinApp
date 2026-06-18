import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🔍</Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          Khám phá
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
          }}
        >
          Tìm kiếm địa điểm du lịch hấp dẫn
        </Text>
      </View>
    </SafeAreaView>
  );
}
