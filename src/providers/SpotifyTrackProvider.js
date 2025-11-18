import { TrackProvider } from "./TrackProvider.js";
import WORKOUT_TRACKS from "../data/workoutTracks.js";

/**
 * Minimal Spotify Web API wrapper for Recommendations + Audio Features.
 * Works with a pasted OAuth token (no backend needed).
 */
export default class SpotifyTrackProvider extends TrackProvider {
  constructor() {
    super();
  }

  /**
   * Target tempo ranges per workout to guide Spotify recommendations.
   */
  static tempoRange(workout) {
    const ranges = {
      cardio: { min: 120, max: 160 },
      strength: { min: 90, max: 120 },
      yoga: { min: 60, max: 90 },
      hiit: { min: 140, max: 180 },
      warmup: { min: 80, max: 100 },
      cooldown: { min: 60, max: 80 },
    };
    return ranges[workout] || ranges.cardio;
  }

  static configForWorkout(workout) {
    return WORKOUT_TRACKS[workout] || WORKOUT_TRACKS.default;
  }

  async getRecommendations(workout, accessToken = null) {
    const config = SpotifyTrackProvider.configForWorkout(workout);
    const curated = Array.isArray(config) ? config : config?.tracks || [];

    // If we don't have any curated tracks, bail early.
    if (!curated.length) return [];

    // Always return at least the curated set for offline/demo use.
    const curatedMapped = curated.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artist,
      bpm: track.bpm ?? null,
      durationMs: track.durationMs ?? null,
      uri: track.uri,
    }));

    // If no token, just return the curated list.
    if (!accessToken) return curatedMapped;

    const seeds = curated
      .map((t) => t.id)
      .filter(Boolean)
      .slice(0, 5);
    const { min, max } = SpotifyTrackProvider.tempoRange(workout);
    const params = new URLSearchParams({
      limit: '20',
      seed_tracks: seeds.join(','),
      min_tempo: String(min),
      max_tempo: String(max),
    });

    try {
      const resp = await fetch(
        `https://api.spotify.com/v1/recommendations?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!resp.ok) {
        throw new Error(`Spotify recommendations failed: ${resp.status}`);
      }

      const data = await resp.json();
      const recommended = (data?.tracks || []).map((track) => ({
        id: track.id,
        name: track.name,
        artist: (track.artists || []).map((a) => a.name).join(', '),
        bpm: null, // recommendation API does not include tempo; leave null
        durationMs: track.duration_ms ?? null,
        uri: track.uri,
      }));

      // Merge curated first (with BPM) followed by recommended, deduped by id.
      const seen = new Set();
      const combined = [...curatedMapped, ...recommended].filter((t) => {
        if (!t.id || !t.uri) return false;
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      return combined;
    } catch (error) {
      console.warn('Falling back to curated tracks due to Spotify error:', error);
      return curatedMapped;
    }
  }
}
