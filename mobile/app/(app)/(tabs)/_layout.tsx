import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabIconMap = {
  home: {
    active: "home",
    inactive: "home-outline",
  },
  saved: {
    active: "bookmark",
    inactive: "bookmark-outline",
  },
  itineraries: {
    active: "calendar",
    inactive: "calendar-outline",
  },
  profile: {
    active: "person",
    inactive: "person-outline",
  },
} as const;

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0f766e",
        tabBarInactiveTintColor: "#111827",
        tabBarStyle: {
          height: 64 + Math.max(insets.bottom, 10),
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingHorizontal: 8,
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          shadowColor: "transparent",
          shadowOpacity: 0,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? tabIconMap.home.active : tabIconMap.home.inactive}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Đã lưu",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? tabIconMap.saved.active : tabIconMap.saved.inactive}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="itineraries"
        options={{
          title: "Lịch trình",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={
                focused
                  ? tabIconMap.itineraries.active
                  : tabIconMap.itineraries.inactive
              }
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Hồ sơ",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? tabIconMap.profile.active : tabIconMap.profile.inactive}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
