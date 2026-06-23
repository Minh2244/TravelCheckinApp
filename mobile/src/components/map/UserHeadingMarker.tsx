import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type * as Location from "expo-location";

function normalizeHeading(value: number) {
  const normalized = value % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

export function UserHeadingMarker({
  heading,
  location,
}: {
  heading: number;
  location: Location.LocationObject;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const latitude = Number(location.coords.latitude);
  const longitude = Number(location.coords.longitude);

  useEffect(() => {
    const timeout = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(timeout);
  }, []);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      flat
      rotation={normalizeHeading(heading)}
      tracksViewChanges={tracksViewChanges}
      zIndex={1000}
    >
      <View style={styles.container}>
        <View style={styles.arrow} />
        <View style={styles.dot} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    position: "absolute",
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 26,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#2563eb",
  },
  dot: {
    position: "absolute",
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    borderWidth: 4,
    borderColor: "#ffffff",
  },
});
