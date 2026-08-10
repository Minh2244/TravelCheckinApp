import type { AiChatPayload } from "../api/aiApi";

type AiRequestContext = NonNullable<AiChatPayload["context"]>;

export const getAiLocationContext = async (): Promise<AiRequestContext | undefined> => {
  if (!navigator.geolocation) return undefined;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          current_location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      () => resolve(undefined),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      },
    );
  });
};
