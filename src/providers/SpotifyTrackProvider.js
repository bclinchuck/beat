import { TrackProvider } from "./TrackProvider.js";

/**
 * Minimal Spotify Web API wrapper for Recommendations + Audio Features.
 * Works with a pasted OAuth token (no backend needed).
 */
const WORKOUT_SEARCH = {
  cardio: {
    query: 'genre:"pop" workout',
    tempo: { min: 110, target: 135, max: 160 },
    minEnergy: 0.4,
    minDanceability: 0.5
  },
  strength: {
    query: 'genre:"rock" gym',
    tempo: { min: 90, target: 115, max: 135 },
    minEnergy: 0.45,
    minDanceability: 0.35
  },
  yoga: {
    query: 'genre:"ambient" calm',
    tempo: { min: 55, target: 70, max: 85 },
    minEnergy: 0.25,
    minDanceability: 0.2
  },
  hiit: {
    query: 'genre:"edm" workout',
    tempo: { min: 135, target: 165, max: 195 },
    minEnergy: 0.6,
    minDanceability: 0.45
  },
  warmup: {
    query: 'genre:"dance" warmup',
    tempo: { min: 80, target: 100, max: 120 },
    minEnergy: 0.35,
    minDanceability: 0.5
  },
  cooldown: {
    query: 'genre:"chill" relax',
    tempo: { min: 55, target: 70, max: 90 },
    minEnergy: 0.2,
    minDanceability: 0.25
  },
  default: {
    query: 'genre:"workout"',
    tempo: { min: 100, target: 120, max: 150 },
    minEnergy: 0.35,
    minDanceability: 0.4
  }
};

export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  static configForWorkout(workout) {
    return WORKOUT_SEARCH[workout] || WORKOUT_SEARCH.default;
  }

  async getRecommendations(workout) {
    const { query, tempo, minEnergy, minDanceability } =
      SpotifyTrackProvider.configForWorkout(workout);
    const { min, max } = tempo;

    const searchResults = await this.#searchTracks(query);
    if (!searchResults.length) return [];

    const ids = searchResults.map((t) => t.id).filter(Boolean);
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

    const filtered = searchResults.filter((track) => {
      const metrics = featuresById[track.id];
      if (!metrics) return false;
      const tempoOk =
        typeof metrics.tempo === "number" &&
        metrics.tempo >= min &&
        metrics.tempo <= max;
      const energyOk =
        typeof metrics.energy === "number"
          ? metrics.energy >= (minEnergy ?? 0.3)
          : true;
      const danceOk =
        typeof metrics.danceability === "number"
          ? metrics.danceability >= (minDanceability ?? 0.3)
          : true;
      return tempoOk && energyOk && danceOk;
    });

    const listToUse = filtered.length ? filtered : searchResults;

    return listToUse.slice(0, 20).map((track) => ({
      id: track.id,
      name: track.name,
      artist: (track.artists || []).map((a) => a.name).join(", "),
      bpm: featuresById[track.id]?.tempo ?? null,
      durationMs: track.duration_ms ?? null
    }));
  }

  async #searchTracks(query) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "50",
      market: "from_token"
    });
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/search?${params.toString()}`
    );
    return data?.tracks?.items ?? [];
  }

  async #fetchAudioFeatures(ids) {
    // API allows up to 100 ids per request
    const chunk = ids.slice(0, 100);
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`
    );
    const out = {};
    for (const f of data?.audio_features ?? []) {
      if (f && f.id) {
        out[f.id] = {
          tempo: f.tempo ?? null,
          energy: f.energy ?? null,
          danceability: f.danceability ?? null
        };
      }
    }
    return out;
  }

  async #fetchJSON(url) {
    console.log("[Spotify] Using token prefix:", this.#token?.slice(0, 15));
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
