import { Magnetometer } from "expo-sensors";
import { useEffect, useState } from "react";

const LOW_PASS_FILTER_ALPHA = 0.35;

function normalizeHeading(angle: number) {
  const normalized = angle % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function useCompass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    let active = true;
    let currentHeading = 0;

    Magnetometer.setUpdateInterval(60);

    const subscription = Magnetometer.addListener((data) => {
      if (!active) return;

      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      angle -= 90;

      if (angle < 0) {
        angle += 360;
      }

      const delta = shortestAngleDelta(currentHeading, angle);
      currentHeading = normalizeHeading(
        currentHeading + LOW_PASS_FILTER_ALPHA * delta,
      );
      setHeading(currentHeading);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return heading;
}
