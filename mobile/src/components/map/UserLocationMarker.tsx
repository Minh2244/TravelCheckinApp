import { useRef, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import { captureRef } from "react-native-view-shot";
import type * as Location from "expo-location";

const USER_MARKER_VIEW_SIZE = 35;
const USER_MARKER_BITMAP_SIZE = PixelRatio.getPixelSizeForLayoutSize(
  USER_MARKER_VIEW_SIZE,
);

function normalizeHeading(value: number) {
  const normalized = value % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

export function UserLocationMarker({
  heading,
  imageUri,
  location,
}: {
  heading: number;
  imageUri: string;
  location: Location.LocationObject;
}) {
  const latitude = Number(location.coords.latitude);
  const longitude = Number(location.coords.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return (
    <Marker
      identifier="current-user-location"
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      image={{ uri: imageUri }}
      rotation={normalizeHeading(heading)}
      flat
      tracksViewChanges={false}
      zIndex={1000}
    />
  );
}

export function UserMarkerBitmapFactory({
  onReady,
}: {
  onReady: (uri: string) => void;
}) {
  const markerRef = useRef<View>(null);
  const [captured, setCaptured] = useState(false);

  const captureMarker = () => {
    if (captured) {
      return;
    }

    setCaptured(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        captureRef(markerRef, {
          format: "png",
          result: "tmpfile",
          quality: 1,
          width: USER_MARKER_BITMAP_SIZE,
          height: USER_MARKER_BITMAP_SIZE,
        })
          .then(onReady)
          .catch(() => setCaptured(false));
      }, 60);
    });
  };

  return (
    <View pointerEvents="none" style={styles.factoryLayer}>
      <View
        ref={markerRef}
        collapsable={false}
        renderToHardwareTextureAndroid
        style={styles.markerCanvas}
        onLayout={captureMarker}
      >
        <View style={styles.halo} />
        <View style={styles.arrow} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  factoryLayer: {
    position: "absolute",
    left: -200,
    top: 0,
    width: USER_MARKER_VIEW_SIZE,
    height: USER_MARKER_VIEW_SIZE,
  },
  markerCanvas: {
    width: USER_MARKER_VIEW_SIZE,
    height: USER_MARKER_VIEW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  arrow: {
    position: "absolute",
    top: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#2563eb",
  },
  dot: {
    position: "absolute",
    left: 10,
    top: 14,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
