import { create } from "zustand";
import { api } from "../lib/api";

interface AppSettingsState {
  support_hotline: string;
  support_zalo: string;
  support_email: string;
  app_background_url: string;
  app_primary_color: string;
  app_secondary_color: string;
  app_text_color: string;
  
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettingsState>) => void;
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  support_hotline: "",
  support_zalo: "",
  support_email: "",
  app_background_url: "",
  app_primary_color: "",
  app_secondary_color: "",
  app_text_color: "",

  fetchSettings: async () => {
    try {
      const resp = await api.get("/auth/public-settings");
      if (resp.data?.success && resp.data?.data) {
        set({
          support_hotline: resp.data.data.support_hotline || "",
          support_zalo: resp.data.data.support_zalo || "",
          support_email: resp.data.data.support_email || "",
          app_background_url: resp.data.data.app_background_url || "",
          app_primary_color: resp.data.data.app_primary_color || "",
          app_secondary_color: resp.data.data.app_secondary_color || "",
          app_text_color: resp.data.data.app_text_color || "",
        });
      }
    } catch (e) {
      console.error("Failed to fetch public settings", e);
    }
  },
  
  updateSettings: (settings) => {
    set(settings);
  }
}));
