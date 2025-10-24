// src/providers/SpotifyTrackProvider.js
import { TrackProvider } from "./TrackProvider.js";

/**
 * SpotifyTrackProvider
 * Minimal wrapper over Spotify Web API using a pasted OAuth access token.
 * Endpoints used:
 *  - GET /v1/recommendations
 *  - GET /v1/audio-features?ids=...
 */
export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  /**
   * @param {string} token - Raw access token (Bearer). Expires ~3600s.
   */
  constructor(token) {
    super();
    // sanitize common paste issues (whitespace, stray quotes)
    this.#token = String(token ?? "").trim().replace(/^["']|["']$/g, "");
  }

  /** Map your workout selection to a seed genre. Tweak as you like. */
  static genreFromWorkout(workout) {
    const map = {
      cardio: "pop",
      strength: "rock",
      yoga: "ambient",
      hiit: "edm",
      warmup: "dance",
      cooldown: "chill",
    };
    return map[workout] || "workout";
  }

  /** Compute a tempo window around HR (min/max clamped to [40, 220]). */
  static tempoWindowFromHR(hr) {
    const target = Math.max(40, Math.min(220, Math.round(hr || 120)));
    const min = Math.max(40, target - 20);
    const max = Math.min(220, target + 20);
    return { min, target, max };
  }

  /**
   * Fetch recommended tracks aligned to BPM/workout and enrich with tempo.
   * Returns a list with { id, name, artist, bpm, durationMs }.
   */
  async getRecommendations(bpm, workout) {
    const genre = SpotifyTrackProvider.genreFromWorkout(workout);
    const { min, target, max } = SpotifyTrackProvider.tempoWindowFromHR(bpm);

    // --- 1) Recommendations
    const params = new URLSearchParams({
      limit: "20",
      seed_genres: genre,
      target_tempo: String(target),
      min_tempo: String(min),
      max_tempo: String(max),
      market: "US", // helps avoid territory-related empties; adjust as needed
    });

    const rec = await this.#fetchJSON(
      `https://api.spotify.com/v1/recommendations?${params.toString()}`
    );

    const tracks = Array.isArray(rec?.tracks) ? rec.tracks : [];
    if (!tracks.length) return [];

    // --- 2) Audio features (tempo) in bulk
    const ids = tracks.map((t) => t?.id).filter(Boolean);
    const featuresById = await this.#fetchAudioFeatures(ids);

    // --- 3) Normalize to your app's shape
    return tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: (t.artists || []).map((a) => a.name).join(", "),
      bpm: featuresById[t.id]?.tempo ?? null,
      durationMs: t.duration_ms ?? null,
    }));
  }

  /** Fetch audio features for up to 100 track IDs; returns { [id]: { tempo } } */
  async #fetchAudioFeatures(ids) {
    const chunk = ids.slice(0, 100);
    if (!chunk.length) return {};
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`
    );
    const out = {};
    for (const f of data?.audio_features ?? []) {
      if (f && f.id) out[f.id] = { tempo: f.tempo ?? null };
    }
    return out;
  }

  /** Internal fetch helper with robust error messages. */
  async #fetchJSON(url) {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${this.#token}` },
    });

    if (!resp.ok) {
      let body = "";
      try {
        body = await resp.text();
      } catch {
        /* ignore */
      }

      // Common friendly hints
      if (resp.status === 401) {
        throw new Error(
          "Spotify 401 Unauthorized: Invalid or expired access token. Mint a new token and try again."
        );
      }
      if (resp.status === 429) {
        const retry = resp.headers.get("Retry-After");
        throw new Error(
          `Spotify 429 Rate Limited: Try again in ${retry ?? "a few"} seconds.`
        );
      }

      // Fallthrough
      throw new Error(`Spotify ${resp.status}: ${body || "Unknown error"}`);
    }

    return resp.json();
  }
}
