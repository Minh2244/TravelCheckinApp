import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import { create } from "zustand";

import { hideToast, showToast } from "../ui/toast-store";

type LocationAccessState = {
  canAskAgain: boolean;
  granted: boolean;
  servicesEnabled: boolean;
  refreshStatus: () => Promise<{
    canAskAgain: boolean;
    granted: boolean;
    servicesEnabled: boolean;
  }>;
  ensureAccess: (featureName?: string) => Promise<boolean>;
};

async function getSnapshot() {
  const [permission, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);

  return {
    granted: permission.status === "granted",
    canAskAgain: permission.canAskAgain ?? false,
    servicesEnabled,
  };
}

export const useLocationPermissionStore = create<LocationAccessState>((set, get) => ({
  canAskAgain: true,
  granted: false,
  servicesEnabled: false,
  refreshStatus: async () => {
    const snapshot = await getSnapshot();
    set(snapshot);
    return snapshot;
  },
  ensureAccess: async (featureName = "tính năng này") => {
    let snapshot = await get().refreshStatus();

    if (!snapshot.granted) {
      showToast(`Cần bật quyền vị trí để dùng ${featureName}.`);

      if (snapshot.canAskAgain) {
        const requested = await Location.requestForegroundPermissionsAsync();
        snapshot = {
          granted: requested.status === "granted",
          canAskAgain: requested.canAskAgain ?? false,
          servicesEnabled: await Location.hasServicesEnabledAsync(),
        };
        set(snapshot);
        if (snapshot.granted) {
          hideToast();
        }
      } else {
        await Linking.openSettings();
        return false;
      }
    }

    if (!snapshot.granted) {
      return false;
    }

    if (!snapshot.servicesEnabled) {
      showToast(`Hãy mở GPS để tiếp tục dùng ${featureName}.`);

      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          return false;
        }
      } else {
        await Linking.openSettings();
        return false;
      }

      snapshot = await get().refreshStatus();

      if (snapshot.servicesEnabled) {
        hideToast();
      }
    }

    return snapshot.granted && snapshot.servicesEnabled;
  },
}));
