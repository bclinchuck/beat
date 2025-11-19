import { TrackProvider } from "./TrackProvider.js";
import WORKOUT_TRACKS from "../data/workoutTracks.js";

/**
 * Lightweight Spotify helper: uses Search API + curated seeds.
 * Avoids /recommendations and /audio-features (endpoints that flake/404).
 */
const WORKOUT_CONFIG = {
  cardio: {
    genres: ["dance", "workout", "edm", "pop", "hip-hop"],
    targetBpm: 140,
  },
  strength: {
    genres: ["rock", "metal", "hip-hop", "workout"],
    targetBpm: 110,
  },
  yoga: {
    genres: ["chill", "ambient", "acoustic", "indie"],
    targetBpm: 70,
  },
  hiit: {
    genres: ["edm", "dance", "electronic", "hip-hop"],
    targetBpm: 165,
  },
  warmup: {
    genres: ["pop", "dance", "indie", "electronic"],
    targetBpm: 100,
  },
  cooldown: {
    genres: ["chill", "acoustic", "indie", "jazz"],
    targetBpm: 70,
  },
};

export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  static configForWorkout(workout) {
    return WORKOUT_CONFIG[workout] || WORKOUT_CONFIG.cardio;
  }

  async getRecommendations(workout) {
    console.log(`[Spotify] Fetching tracks for workout: ${workout}`);
    const config = SpotifyTrackProvider.configForWorkout(workout);
    const targetBpm = config.targetBpm;
    const curated = WORKOUT_TRACKS[workout] || WORKOUT_TRACKS.cardio || [];

    // If no token or token invalid, just return curated list (for demo/offline).
    if (!this.#token) {
      console.log("[Spotify] No token; using curated tracks only");
      return this.#mapTracks(curated, targetBpm);
    }

    // Try search-based fetch by genres
    const searchTracks = await this.#searchByGenres(config.genres);
    if (searchTracks.length) {
      return this.#mapTracks(searchTracks, targetBpm);
    }

    // Fallback to curated list if search failed/empty
    console.warn("[Spotify] Search returned no tracks; using curated list");
    return this.#mapTracks(curated, targetBpm);
  }

  #mapTracks(tracks, fallbackBpm) {
    return (tracks || []).map((t) => ({
      id: t.id,
      name: t.name,
      artist: (t.artists || []).map((a) => a.name).join(", "),
      bpm: fallbackBpm ?? null,
      durationMs: t.duration_ms ?? t.durationMs ?? 210000,
      uri: t.uri || t.spotifyUri,
      spotifyUri: t.uri || t.spotifyUri,
      previewUrl: t.preview_url,
      externalUrl: t.external_urls?.spotify,
    })).filter((t) => t.id && t.uri);
  }

  async #searchByGenres(genres = []) {
    if (!genres.length) return [];
    const query = genres.map((g) => `genre:${g}`).join(" OR ");
    const params = new URLSearchParams({
      q: query,
      type: "track",
      market: "from_token",
      limit: "20",
    });
    const url = `https://api.spotify.com/v1/search?${params.toString()}`;
    console.log(`[Spotify] Search URL: ${url}`);

    const data = await this.#fetchJSON(url);
    return data?.tracks?.items || [];
  }

  async #fetchJSON(url) {
    console.log(`[Spotify] Fetching: ${url}`);
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
      },
    });

    console.log(`[Spotify] Response status: ${resp.status}`);

    if (!resp.ok) {
      const msg = await resp.text();
      console.error(`[Spotify] Error response: ${msg}`);
      let friendly = msg;
      try {
        const parsed = JSON.parse(msg || "{}");
        friendly = parsed?.error?.message || msg;
      } catch {}
      throw new Error(`Spotify ${resp.status}: ${friendly}`);
    }

    return resp.json();
  }
}
