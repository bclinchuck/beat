import { TrackProvider } from "./TrackProvider.js";

/**
 * Minimal Spotify Web API wrapper for Recommendations + Audio Features.
 * Works with a pasted OAuth token (no backend needed).
 */
const WORKOUT_TRACKS = {
  cardio: {
    tracks: [
      { id: "0E9ZjEAyAwOXZ7wJC0PD33", bpm: 130 },
      { id: "0tgVpDi06FyKpA1z0VMD4v", bpm: 96 },
      { id: "6habFhsOp2NvshLv26DqMb", bpm: 140 },
      { id: "2PpruBYCo4H7WOBJ7Q2EwM", bpm: 113 },
      { id: "6I9VzXrHxO9rA9A5euc8Ak", bpm: 113 },
      { id: "1sJGefTWVVQErsVz02TrsH", bpm: 135 },
      { id: "48MGi2YlNmXnByQ3LVaehO", bpm: 128 }
    ]
  },
  strength: {
    tracks: [
      { id: "7ouMYWpwJ422jRcDASZB7P", bpm: 134 },
      { id: "5ChkMS8OtdzJeqyybCc9R5", bpm: 124 },
      { id: "0g5U1Qm9WioNbZrJvPtoEg", bpm: 89 },
      { id: "0N92pkapltvbwijf5smP6r", bpm: 128 },
      { id: "6PdAyzpuYTBZjBZzZPMtFX", bpm: 122 }
    ]
  },
  yoga: {
    tracks: [
      { id: "4iV5W9uYEdYUVa79Axb7Rh", bpm: 74 },
      { id: "6JEK0CvvjDjjMUBFoXShNZ", bpm: 73 },
      { id: "2JhR4tjuc3MIKa8v2JaKkk", bpm: 62 },
      { id: "51rXHuKN8Loc4sUlKPODgH", bpm: 60 },
      { id: "0kN8xEmgMW9mh7UmDYHlJP", bpm: 70 }
    ]
  },
  hiit: {
    tracks: [
      { id: "3Zwu2K0Qa5sT6teCCHPShP", bpm: 146 },
      { id: "2QZ7WLBE8h2y1Y5Fb8RYbU", bpm: 125 },
      { id: "6fujklziTHa8uoM5OQSfIo", bpm: 100 },
      { id: "1B75hgRqe7A4fwee3g3Wmu", bpm: 150 },
      { id: "2akU3TQbYKZvkOU1T7gRHi", bpm: 125 }
    ]
  },
  warmup: {
    tracks: [
      { id: "3KkXRkHbMCARz0aVfEt68P", bpm: 113 },
      { id: "0VsRxz5sCPQjD1IHY9OSD3", bpm: 110 },
      { id: "6CJ9N5ZsO8g6CRzJux1v5C", bpm: 102 },
      { id: "0E4ZVKmnAsFRPHCNeT1RUa", bpm: 100 },
      { id: "3BIL3gxETKDeILrD6vScO3", bpm: 118 }
    ]
  },
  cooldown: {
    tracks: [
      { id: "4FRW5Nza1Ym91BGV4nFWXI", bpm: 73 },
      { id: "6w7d9Iv7FsfmK1LJUbLOGg", bpm: 80 },
      { id: "0afhq8XCExXpqazXczTSve", bpm: 86 },
      { id: "5j7nWZyghdZO4y0Xny3Z8S", bpm: 70 },
      { id: "6dGnYIeXmHdcikdzNNDMm2", bpm: 65 }
    ]
  },
  default: {
    tracks: [
      { id: "7GhIk7Il098yCjg4BQjzvb", bpm: 120 },
      { id: "0VjIjW4GlUZAMYd2vXMi3b", bpm: 170 },
      { id: "2FgHPfRprDaylrSRVf1UlN", bpm: 128 }
    ]
  }
};

export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  static configForWorkout(workout) {
    return WORKOUT_TRACKS[workout] || WORKOUT_TRACKS.default;
  }

  async getRecommendations(workout) {
    const { tracks } = SpotifyTrackProvider.configForWorkout(workout);
    if (!tracks?.length) return [];

    const batches = [];
    for (let i = 0; i < tracks.length; i += 50) {
      batches.push(tracks.slice(i, i + 50));
    }

    const fetchedDetails = [];
    for (const batch of batches) {
      try {
        const details = await this.#fetchTrackDetails(batch.map((t) => t.id));
        fetchedDetails.push(...details);
      } catch (error) {
        if (error?.status === 401 || error?.status === 403) {
          throw error;
        }
        console.warn("Spotify track details unavailable for batch", batch, error);
      }
    }

    if (!fetchedDetails.length) {
      // Fallback to static metadata
      return tracks.map((track) => ({
        id: track.id,
        name: "Spotify Track",
        artist: "Unknown Artist",
        bpm: track.bpm ?? null,
        durationMs: null
      }));
    }

    const detailMap = fetchedDetails.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    return tracks
      .map((track) => {
        const detail = detailMap[track.id];
        if (!detail) return null;
        return {
          id: detail.id,
          name: detail.name,
          artist: (detail.artists || [])
            .map((artist) => artist.name)
            .join(", "),
          bpm: track.bpm ?? null,
          durationMs: detail.duration_ms ?? null,
          uri: detail.uri,
        };
      })
      .filter(Boolean);
  }

  async #fetchTrackDetails(ids) {
    const chunk = ids.slice(0, 50);
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/tracks?ids=${chunk.join(",")}`
    );
    return data?.tracks ?? [];
  }

  async #fetchJSON(url) {
    if (!this.#token) {
      throw new Error("Spotify token missing. Reconnect to continue.");
    }
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
      const error = new Error(`Spotify ${resp.status}: ${friendlyMsg || msg}`);
      error.status = resp.status;
      throw error;
    }
    return resp.json();
  }
}
