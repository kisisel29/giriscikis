import type { LocationFix } from "@/lib/attendance/types";

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earth = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function measureLocation(input: {
  siteLat: number;
  siteLon: number;
  allowedRadius: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}): LocationFix {
  const { latitude, longitude, accuracy, siteLat, siteLon, allowedRadius } = input;
  if (
    latitude == null ||
    longitude == null ||
    accuracy == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracy)
  ) {
    return { verified: false, distanceMeters: null, accuracy: null, failure: "MISSING" };
  }
  if (accuracy > Math.max(allowedRadius * 3, 300)) {
    return {
      verified: false,
      distanceMeters: null,
      accuracy: Math.round(accuracy),
      failure: "INACCURATE",
    };
  }
  const distance = Math.round(haversineMeters(siteLat, siteLon, latitude, longitude));
  if (distance > allowedRadius) {
    return {
      verified: false,
      distanceMeters: distance,
      accuracy: Math.round(accuracy),
      failure: "OUTSIDE",
    };
  }
  return {
    verified: true,
    distanceMeters: distance,
    accuracy: Math.round(accuracy),
    failure: null,
  };
}
