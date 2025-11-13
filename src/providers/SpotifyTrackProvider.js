import { TrackProvider } from "./TrackProvider.js";

/**
 * Minimal Spotify Web API wrapper for Recommendations + Audio Features.
 * Works with a pasted OAuth token (no backend needed).
 */
export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  // Map your workout to seed genres (tweak to taste)
  static genreFromWorkout(workout) {
    const map = {
      cardio: "pop",
      strength: "rock",
      yoga: "ambient",
      hiit: "edm",
      warmup: "dance",
      cooldown: "chill"
    };
    return map[workout] || "workout";
  }

  static tempoWindowFromHR(hr) {
    const target = Math.max(40, Math.min(220, Math.round(hr)));
    const min = Math.max(40, target - 20);
    const max = Math.min(220, target + 20);
    return { min, target, max };
  }

  async getRecommendations(bpm, workout) {
    const genre = SpotifyTrackProvider.genreFromWorkout(workout);
    const { min, target, max } = SpotifyTrackProvider.tempoWindowFromHR(bpm);

    // 1) /v1/recommendations
    const params = new URLSearchParams({
      limit: "20",
      market: "from_token",
      seed_genres: genre,
      target_tempo: String(target),
      min_tempo: String(min),
      max_tempo: String(max),
      min_energy: "0.3",
      min_danceability: "0.3"
    });

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
    const featuresById = await this.#fetchAudioFeatures(ids);

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
