import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
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
  explore: {
    active: "map",
    inactive: "map-outline",
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
        tabBarInactiveTintColor: "#475569",
        sceneStyle: {
          backgroundColor: "#eef2f3",
        },
        tabBarStyle: {
          height: 50 + Math.max(insets.bottom, Platform.OS === "android" ? 2 : 6),
          paddingTop: Platform.OS === "android" ? 4 : 3,
          paddingBottom: Math.max(insets.bottom, Platform.OS === "android" ? 2 : 6),
          paddingHorizontal: 10,
          backgroundColor: "#ffffff",
          borderTopWidth: Platform.OS === "android" ? 0 : 1,
          borderTopColor: "#dbe4ea",
          elevation: Platform.OS === "android" ? 0 : 8,
          shadowColor: "#0f172a",
          shadowOpacity: Platform.OS === "android" ? 0 : 0.06,
          shadowRadius: 10,
          shadowOffset: {
            width: 0,
            height: -4,
          },
        },
        tabBarIconStyle: {
          marginBottom: Platform.OS === "android" ? -1 : 0,
        },
        tabBarItemStyle: {
          paddingVertical: Platform.OS === "android" ? 0 : 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: Platform.OS === "android" ? -4 : -1,
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
        name="explore"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? tabIconMap.explore.active : tabIconMap.explore.inactive}
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
