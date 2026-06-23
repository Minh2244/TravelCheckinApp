import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Marker, type LatLng } from "react-native-maps";

import { resolveBackendUrl } from "../../lib/url";
import { getCachedLocationMarkerImage } from "../../modules/map/marker-image-cache";
import type { LocationItem } from "../../types/location";

function getLocationImage(location: LocationItem) {
  return resolveBackendUrl(location.first_image || location.images?.[0] || null);
}

function getFallbackVisual(locationType: string | null | undefined) {
  const normalized = String(locationType || "").toLowerCase();

  if (normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("cafe")) {
    return { backgroundColor: "#fff7ed", color: "#c2410c", label: "AN" };
  }

  if (normalized.includes("hotel") || normalized.includes("resort") || normalized.includes("room")) {
    return { backgroundColor: "#eff6ff", color: "#1d4ed8", label: "KS" };
  }

  if (normalized.includes("tour") || normalized.includes("travel") || normalized.includes("ticket")) {
    return { backgroundColor: "#f5f3ff", color: "#6d28d9", label: "DL" };
  }

  return { backgroundColor: "#ecfdf5", color: "#0f766e", label: "TC" };
}

export function OwnerCachedMarker({
  coordinate,
  location,
  onSelect,
  selected,
}: {
  coordinate: LatLng;
  location: LocationItem;
  onSelect: (location: LocationItem) => void;
  selected: boolean;
}) {
  const imageUrl = getLocationImage(location);
  const visual = useMemo(
    () => getFallbackVisual(location.location_type),
    [location.location_type],
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cachedImageUri, setCachedImageUri] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const stopTrackingSoon = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => setTracksViewChanges(false), 250);
  };

  useEffect(() => {
    let active = true;

    setTracksViewChanges(true);
    setCachedImageUri(null);
    setImageFailed(false);

    if (!imageUrl) {
      stopTrackingSoon();
      return () => {
        active = false;
      };
    }

    getCachedLocationMarkerImage({
      imageUrl,
      locationId: location.location_id,
    })
      .then((uri) => {
        if (!active) return;

        setCachedImageUri(uri);
        setImageFailed(!uri);
        stopTrackingSoon();
      })
      .catch(() => {
        if (!active) return;

        setImageFailed(true);
        stopTrackingSoon();
      });

    return () => {
      active = false;
    };
  }, [imageUrl, location.location_id]);

  useEffect(() => {
    setTracksViewChanges(true);
    stopTrackingSoon();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [selected]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      zIndex={selected ? 30 : 10}
      tracksViewChanges={tracksViewChanges}
      onPress={(event) => {
        event.stopPropagation?.();
        onSelect(location);
      }}
    >
      <View
        style={[
          styles.frame,
          selected && styles.frameSelected,
        ]}
      >
        {cachedImageUri && !imageFailed ? (
          <Image
            source={{ uri: cachedImageUri }}
            style={styles.image}
            resizeMode="cover"
            fadeDuration={0}
            onLoadEnd={stopTrackingSoon}
            onError={() => {
              setImageFailed(true);
              stopTrackingSoon();
            }}
          />
        ) : (
          <View
            style={[
              styles.fallback,
              { backgroundColor: visual.backgroundColor },
            ]}
          >
            <Text style={[styles.fallbackText, { color: visual.color }]}>
              {visual.label}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 3,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  frameSelected: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: "#e2e8f0",
  },
  fallback: {
    flex: 1,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontSize: 13,
    fontWeight: "900",
  },
});
