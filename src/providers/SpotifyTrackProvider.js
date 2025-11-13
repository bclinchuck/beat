import { TrackProvider } from "./TrackProvider.js";

/**
 * Minimal Spotify Web API wrapper for Recommendations + Audio Features.
 * Works with a pasted OAuth token (no backend needed).
 */
const WORKOUT_SEEDS = {
  cardio: {
    genre: "pop",
    tracks: [
      "6habFhsOp2NvshLv26DqMb", // Lean On
      "3AJwUDP919kvQ9QcozQPxg", // Titanium
      "0e7ipj03S05BNilyu5bRzt", // Blinding Lights
      "4cG7HUWYHBV6R6tHn1gxrl", // POWER
      "2KSJNEd0SEpKULmZyGq1XK" // Don't Start Now
    ],
    tempo: { min: 120, target: 140, max: 160 }
  },
  strength: {
    genre: "rock",
    tracks: [
      "7ouMYWpwJ422jRcDASZB7P", // Thunderstruck
      "0g5U1Qm9WioNbZrJvPtoEg", // Lose Yourself
      "5ChkMS8OtdzJeqyybCc9R5", // Seven Nation Army
      "2I1vu6PNMsYSaeng4lJifV",
      "4cOdK2wGLETKBW3PvgPWqT" // Never Gonna Give You Up (fun)
    ],
    tempo: { min: 95, target: 115, max: 135 }
  },
  yoga: {
    genre: "ambient",
    tracks: [
      "4iV5W9uYEdYUVa79Axb7Rh", // Holocene
      "6JEK0CvvjDjjMUBFoXShNZ", // Skinny Love
      "2JhR4tjuc3MIKa8v2JaKkk",
      "51rXHuKN8Loc4sUlKPODgH",
      "0kN8xEmgMW9mh7UmDYHlJP"
    ],
    tempo: { min: 55, target: 70, max: 85 }
  },
  hiit: {
    genre: "edm",
    tracks: [
      "3Zwu2K0Qa5sT6teCCHPShP", // Can't Hold Us
      "1xznGGDReH1oQq0xzbwXa3", // Closer
      "2akU3TQbYKZvkOU1T7gRHi", // Believer
      "2QZ7WLBE8h2y1Y5Fb8RYbU", // The Nights
      "6fujklziTHa8uoM5OQSfIo" // Turn Down for What
    ],
    tempo: { min: 140, target: 165, max: 190 }
  },
  warmup: {
    genre: "dance",
    tracks: [
      "0tgVpDi06FyKpA1z0VMD4v", // Shape of You
      "2PpruBYCo4H7WOBJ7Q2EwM", // Get Lucky
      "6I9VzXrHxO9rA9A5euc8Ak", // Can't Stop the Feeling!
      "3KkXRkHbMCARz0aVfEt68P",
      "0E9ZjEAyAwOXZ7wJC0PD33"
    ],
    tempo: { min: 90, target: 105, max: 120 }
  },
  cooldown: {
    genre: "chill",
    tracks: [
      "4FRW5Nza1Ym91BGV4nFWXI", // Gravity
      "6w7d9Iv7FsfmK1LJUbLOGg", // Pink + White
      "0afhq8XCExXpqazXczTSve", // Yellow
      "5j7nWZyghdZO4y0Xny3Z8S",
      "6dGnYIeXmHdcikdzNNDMm2"
    ],
    tempo: { min: 55, target: 70, max: 90 }
  },
  default: {
    genre: "workout",
    tracks: [
      "7GhIk7Il098yCjg4BQjzvb",
      "0VjIjW4GlUZAMYd2vXMi3b",
      "2FgHPfRprDaylrSRVf1UlN"
    ],
    tempo: { min: 100, target: 120, max: 150 }
  }
};

export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  // Map your workout to seed genres (tweak to taste)
  static configForWorkout(workout) {
    return WORKOUT_SEEDS[workout] || WORKOUT_SEEDS.default;
  }

  async getRecommendations(workout) {
    const { genre, tracks: seedTracks, tempo } =
      SpotifyTrackProvider.configForWorkout(workout);
    const { min, target, max } = tempo;

    // 1) /v1/recommendations
    const trackSeeds = Array.isArray(seedTracks) ? seedTracks.slice(0, 4) : [];

    const params = new URLSearchParams({
      limit: "20",
      market: "from_token",
      target_tempo: String(target),
      min_tempo: String(min),
      max_tempo: String(max),
      min_energy: "0.3",
      min_danceability: "0.3"
    });

    if (genre) {
      params.set("seed_genres", genre);
    }
    if (trackSeeds.length) {
      params.set("seed_tracks", trackSeeds.join(","));
    }

    let rec;
    try {
      rec = await this.#fetchJSON(
        `https://api.spotify.com/v1/recommendations?${params.toString()}`
      );
    } catch (error) {
      // Spotify returns 404 when no tracks match; treat as empty results
      if (typeof error.message === "string" && error.message.startsWith("Spotify 404")) {
        return [];
      }
      throw error;
    }

    const tracks = Array.isArray(rec?.tracks) ? rec.tracks : [];
    if (!tracks.length) return [];

    const ids = tracks.map(t => t.id).filter(Boolean);
    let featuresById = {};
    try {
      featuresById = await this.#fetchAudioFeatures(ids);
    } catch (error) {
      if (typeof error.message === "string" && error.message.startsWith("Spotify 404")) {
        featuresById = {};
      } else {
        throw error;
      }
    }

    // Normalize to the shape your app already uses
    return tracks.map(t => ({
      id: t.id,
      name: t.name,
      artist: (t.artists || []).map(a => a.name).join(", "),
      bpm: featuresById[t.id]?.tempo ?? null,
      durationMs: t.duration_ms ?? null
    }));
  }

  async #fetchAudioFeatures(ids) {
    // API allows up to 100 ids per request
    const chunk = ids.slice(0, 100);
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`
    );
    const out = {};
    for (const f of data?.audio_features ?? []) {
      if (f && f.id) out[f.id] = { tempo: f.tempo ?? null };
    }
    return out;
  }

  async #fetchJSON(url) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${this.#token}` }
    });
    if (!resp.ok) {
      // Surface a friendly error (401 = expired/invalid token)
      const msg = await resp.text();
      let friendlyMsg = msg;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) {
          friendlyMsg = parsed.error.message;
        }
      } catch {
        // ignore JSON parse issues
      }
      throw new Error(`Spotify ${resp.status}: ${friendlyMsg || msg}`);
    }
    return resp.json();
  }
}
