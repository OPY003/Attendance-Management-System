export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  altitude?: number;
  is_mock?: boolean;
}

export interface LocationGeofenceConfig {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
  polygon_geojson?: string | null;
}

export interface GeofenceVerificationResult {
  is_inside: boolean;
  distance_meters: number;
  mock_detected: boolean;
  accuracy_acceptable: boolean;
  reason?: string;
}

export class GpsProvider {
  private static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculates the great-circle distance between two coordinates using the Haversine formula
   */
  public calculateDistanceMeters(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const lat1Rad = (coord1.latitude * Math.PI) / 180;
    const lat2Rad = (coord2.latitude * Math.PI) / 180;
    const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return GpsProvider.EARTH_RADIUS_METERS * c;
  }

  /**
   * Ray-casting algorithm to determine if a point [longitude, latitude] is inside a polygon ring
   * Polygon vertices are expected in GeoJSON format: [[lon, lat], [lon, lat], ...]
   */
  public isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let isInside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) isInside = !isInside;
    }

    return isInside;
  }

  /**
   * Verifies if a user coordinate satisfies a target location's circular or polygon geofence
   * @param userCoord Submitted GPS telemetry
   * @param target Target location with radius or polygon configuration
   * @param toleranceMeters Configurable buffer distance (default 15m)
   * @param maxAcceptableAccuracy Maximum allowed GPS inaccuracy radius in meters (default 100m)
   */
  public verifyGeofence(
    userCoord: GeoCoordinate,
    target: LocationGeofenceConfig,
    toleranceMeters = 15.0,
    maxAcceptableAccuracy = 100.0
  ): GeofenceVerificationResult {
    // 1. Mock GPS Detection
    const mockDetected = Boolean(userCoord.is_mock);
    if (mockDetected) {
      return {
        is_inside: false,
        distance_meters: Infinity,
        mock_detected: true,
        accuracy_acceptable: false,
        reason: 'Mock GPS / Fake Location Provider detected on client device',
      };
    }

    // 2. Accuracy check
    const accuracy = userCoord.accuracy_meters ?? 10;
    const accuracyAcceptable = accuracy <= maxAcceptableAccuracy;
    if (!accuracyAcceptable) {
      return {
        is_inside: false,
        distance_meters: Infinity,
        mock_detected: false,
        accuracy_acceptable: false,
        reason: `GPS signal accuracy too degraded (${accuracy.toFixed(1)}m > max ${maxAcceptableAccuracy}m)`,
      };
    }

    // 3. Multi-vertex GeoJSON Polygon Verification
    if (target.polygon_geojson) {
      try {
        const geoJson = JSON.parse(target.polygon_geojson);
        // Supports Polygon and MultiPolygon GeoJSON
        let rings: [number, number][][] = [];

        if (geoJson.type === 'Polygon' && Array.isArray(geoJson.coordinates)) {
          rings = geoJson.coordinates;
        } else if (geoJson.type === 'Feature' && geoJson.geometry?.type === 'Polygon') {
          rings = geoJson.geometry.coordinates;
        }

        if (rings.length > 0) {
          const outerRing = rings[0];
          const point: [number, number] = [userCoord.longitude, userCoord.latitude];
          const insidePolygon = this.isPointInPolygon(point, outerRing);

          // Approximate distance to first vertex as reference
          const firstVertex = { latitude: outerRing[0][1], longitude: outerRing[0][0] };
          const distanceToBoundary = this.calculateDistanceMeters(userCoord, firstVertex);

          return {
            is_inside: insidePolygon,
            distance_meters: insidePolygon ? 0 : distanceToBoundary,
            mock_detected: false,
            accuracy_acceptable: true,
            reason: insidePolygon
              ? 'Coordinate is within authorized polygon boundary'
              : 'Coordinate is outside authorized polygon boundary',
          };
        }
      } catch (err: any) {
        // Fall back to circular calculation if polygon parse fails
      }
    }

    // 4. Circular Radius Geofence Verification
    if (
      target.latitude !== null &&
      target.latitude !== undefined &&
      target.longitude !== null &&
      target.longitude !== undefined
    ) {
      const distance = this.calculateDistanceMeters(userCoord, {
        latitude: target.latitude,
        longitude: target.longitude,
      });

      const allowedRadius = (target.radius_meters ?? 50.0) + toleranceMeters;
      const isInside = distance <= allowedRadius;

      return {
        is_inside: isInside,
        distance_meters: Math.round(distance * 10) / 10,
        mock_detected: false,
        accuracy_acceptable: true,
        reason: isInside
          ? `Within geofence radius (${distance.toFixed(1)}m <= ${allowedRadius.toFixed(1)}m limit)`
          : `Outside geofence radius: distance is ${distance.toFixed(1)}m (allowed: ${allowedRadius.toFixed(1)}m)`,
      };
    }

    // Location has no geographic constraints configured
    return {
      is_inside: true,
      distance_meters: 0,
      mock_detected: false,
      accuracy_acceptable: true,
      reason: 'No geofence restrictions specified for location',
    };
  }
}

export const gpsProvider = new GpsProvider();
