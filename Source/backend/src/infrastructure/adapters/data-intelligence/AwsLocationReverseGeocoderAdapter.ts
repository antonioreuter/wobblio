import { LocationClient, SearchPlaceIndexForPositionCommand } from '@aws-sdk/client-location';
import type { IReverseGeocoder, GeocodedLocation } from '@core/ports/data-intelligence/IReverseGeocoder';
import { alpha3ToAlpha2 } from './iso3166Alpha3';

// Reverse-geocodes upload coordinates via AWS Location (in-account, no third-party
// coordinate sharing). Coarse output only — the country (mapped alpha-3 → alpha-2)
// and the subdivision name; raw coordinates are discarded after the call. Tier-2 geo
// is best-effort, so every failure path resolves to null rather than throwing.
export class AwsLocationReverseGeocoderAdapter implements IReverseGeocoder {
  private readonly client: LocationClient;

  constructor(region: string, private readonly placeIndexName: string) {
    this.client = new LocationClient({ region });
  }

  async reverseGeocode(lat: number, lon: number): Promise<GeocodedLocation | null> {
    if (!this.placeIndexName) return null;
    try {
      const response = await this.client.send(
        new SearchPlaceIndexForPositionCommand({
          IndexName: this.placeIndexName,
          Position: [lon, lat], // AWS Location takes [longitude, latitude]
          MaxResults: 1,
        }),
      );
      const place = response.Results?.[0]?.Place;
      if (!place?.Country) return null;
      const countryCode = alpha3ToAlpha2(place.Country);
      if (!countryCode) return null;
      return { countryCode, regionText: place.Region?.trim() || null };
    } catch {
      return null;
    }
  }
}
