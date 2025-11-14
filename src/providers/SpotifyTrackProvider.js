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

  static configForWorkout(workout) {
    return WORKOUT_TRACKS[workout] || WORKOUT_TRACKS.default;
  }

  async getRecommendations(workout) {
    const config = SpotifyTrackProvider.configForWorkout(workout);
    const tracks = Array.isArray(config) ? config : config?.tracks || [];
    if (!tracks.length) return [];

    return tracks.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artist,
      bpm: track.bpm ?? null,
      durationMs: track.durationMs ?? null,
      uri: track.uri,
    }));
  }
}
