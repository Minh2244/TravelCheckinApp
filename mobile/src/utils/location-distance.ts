export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

const toRadians = (value: number) => (value * Math.PI) / 180;

export function calculateDistanceKm(
  from: Coordinates,
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): number | null {
  const toLatitude = Number(latitude);
  const toLongitude = Number(longitude);

  if (!Number.isFinite(toLatitude) || !Number.isFinite(toLongitude)) {
    return null;
  }

  const latitudeDelta = toRadians(toLatitude - from.latitude);
  const longitudeDelta = toRadians(toLongitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const destinationLatitude = toRadians(toLatitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function formatDistanceKm(distance: number): string {
  const rounded = Math.round(distance * 10) / 10;
  return `${rounded.toFixed(1).replace(/\.0$/, "")}km`;
}
