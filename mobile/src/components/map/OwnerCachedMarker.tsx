import { useMemo } from "react";
import { Marker, type LatLng } from "react-native-maps";

import type { LocationItem } from "../../types/location";

function getFallbackColor(locationType: string | null | undefined) {
  const normalized = String(locationType || "").toLowerCase();

  if (normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("cafe")) {
    return "#f97316";
  }

  if (normalized.includes("hotel") || normalized.includes("resort") || normalized.includes("room")) {
    return "#2563eb";
  }

  if (normalized.includes("tour") || normalized.includes("travel") || normalized.includes("ticket")) {
    return "#7c3aed";
  }

  return "#0f766e";
}

export function OwnerCachedMarker({
  coordinate,
  location,
  imageUri,
  onSelect,
  selected,
}: {
  coordinate: LatLng;
  location: LocationItem;
  imageUri?: string | null;
  onSelect: (location: LocationItem) => void;
  selected: boolean;
}) {
  const fallbackColor = useMemo(
    () => getFallbackColor(location.location_type),
    [location.location_type],
  );

  return (
    <Marker
      key={imageUri || `fallback-${location.location_id}`}
      identifier={`owner-location-${location.location_id}`}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={selected ? 30 : 10}
      image={imageUri ? { uri: imageUri } : undefined}
      pinColor={imageUri ? undefined : fallbackColor}
      tracksViewChanges={false}
      onPress={(event) => {
        event.stopPropagation?.();
        onSelect(location);
      }}
    />
  );
}
