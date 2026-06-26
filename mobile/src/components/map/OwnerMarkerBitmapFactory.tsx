import { useEffect, useRef, useState } from "react";
import { Image, PixelRatio, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { resolveBackendUrl } from "../../lib/url";
import { getCachedLocationMarkerImage } from "../../modules/map/marker-image-cache";
import type { LocationItem } from "../../types/location";

const MARKER_VIEW_SIZE = 38;
const MARKER_BITMAP_SIZE = PixelRatio.getPixelSizeForLayoutSize(MARKER_VIEW_SIZE);

function getLocationImage(location: LocationItem) {
  return resolveBackendUrl(location.first_image || location.images?.[0] || null);
}

function MarkerBitmap({
  location,
  onReady,
}: {
  location: LocationItem;
  onReady: (locationId: number, uri: string) => void;
}) {
  const markerRef = useRef<View>(null);
  const capturedSourceRef = useRef<string | null>(null);
  const [sourceUri, setSourceUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const imageUrl = getLocationImage(location);

    setSourceUri(null);
    capturedSourceRef.current = null;

    if (!imageUrl) {
      return () => {
        active = false;
      };
    }

    getCachedLocationMarkerImage({
      imageUrl,
      locationId: location.location_id,
    }).then((uri) => {
      if (active) {
        setSourceUri(uri);
      }
    });

    return () => {
      active = false;
    };
  }, [location.first_image, location.images, location.location_id]);

  const captureMarker = () => {
    if (!sourceUri || capturedSourceRef.current === sourceUri) {
      return;
    }

    capturedSourceRef.current = sourceUri;

    requestAnimationFrame(() => {
      setTimeout(() => {
        captureRef(markerRef, {
          format: "png",
          result: "tmpfile",
          quality: 1,
          width: MARKER_BITMAP_SIZE,
          height: MARKER_BITMAP_SIZE,
        })
          .then((uri) => onReady(location.location_id, uri))
          .catch(() => onReady(location.location_id, sourceUri));
      }, 40);
    });
  };

  if (!sourceUri) {
    return null;
  }

  return (
    <View
      ref={markerRef}
      collapsable={false}
      renderToHardwareTextureAndroid
      style={styles.markerFrame}
    >
      <Image
        source={{ uri: sourceUri }}
        style={styles.markerImage}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={captureMarker}
      />
    </View>
  );
}

export function OwnerMarkerBitmapFactory({
  locations,
  onReady,
}: {
  locations: LocationItem[];
  onReady: (locationId: number, uri: string) => void;
}) {
  return (
    <View pointerEvents="none" style={styles.factoryLayer}>
      {locations.map((location) => (
        <MarkerBitmap
          key={`${location.location_id}-${location.first_image || location.images?.[0] || "none"}`}
          location={location}
          onReady={onReady}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  factoryLayer: {
    position: "absolute",
    left: -200,
    top: 0,
    width: MARKER_VIEW_SIZE,
  },
  markerFrame: {
    width: MARKER_VIEW_SIZE,
    height: MARKER_VIEW_SIZE,
    marginBottom: 2,
    padding: 2,
    borderRadius: MARKER_VIEW_SIZE / 2,
    borderWidth: 1,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  markerImage: {
    width: "100%",
    height: "100%",
    borderRadius: (MARKER_VIEW_SIZE - 6) / 2,
    backgroundColor: "#e2e8f0",
  },
});
