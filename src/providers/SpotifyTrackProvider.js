import { TrackProvider } from "./TrackProvider.js";

/**
 * Spotify Web API wrapper for Recommendations + Audio Features.
 * Fetches random songs based on workout type, genres, and tempo ranges.
 */
const WORKOUT_CONFIG = {
  cardio: {
    genres: ["pop", "dance", "electronic", "hip-hop", "workout"],
    tempo: { min: 120, target: 140, max: 160 }
  },
  strength: {
    genres: ["rock", "metal", "hip-hop", "workout", "hard-rock"],
    tempo: { min: 95, target: 115, max: 135 }
  },
  yoga: {
    genres: ["ambient", "chill", "classical", "indie", "acoustic"],
    tempo: { min: 55, target: 70, max: 85 }
  },
  hiit: {
    genres: ["electronic", "dance", "edm", "hip-hop", "metal"],
    tempo: { min: 140, target: 165, max: 190 }
  },
  warmup: {
    genres: ["pop", "indie", "electronic", "dance", "alternative"],
    tempo: { min: 90, target: 105, max: 120 }
  },
  cooldown: {
    genres: ["ambient", "chill", "acoustic", "indie", "classical"],
    tempo: { min: 55, target: 70, max: 90 }
  }
};

export default class SpotifyTrackProvider extends TrackProvider {
  #token;

  constructor(token) {
    super();
    this.#token = token;
  }

  /**
   * Get random Spotify recommendations for the given workout
   * @param {string} workout - one of: cardio|strength|yoga|hiit|warmup|cooldown
   * @returns {Promise<Array>} Array of random track objects
   */
  async getRecommendations(workout) {
    const config = WORKOUT_CONFIG[workout] || WORKOUT_CONFIG.cardio;
    const { genres, tempo } = config;
    const { min, target, max } = tempo;

    // Randomly select 1-3 genres for variety
    const selectedGenres = this.#getRandomGenres(genres, 3);

    const params = new URLSearchParams({
      limit: "20",
      market: "from_token",
      seed_genres: selectedGenres.join(","),
      target_tempo: String(target),
      min_tempo: String(min),
      max_tempo: String(max),
      min_energy: "0.3",
      min_danceability: "0.3"
    });

    try {
      const rec = await this.#fetchJSON(
        `https://api.spotify.com/v1/recommendations?${params.toString()}`
      );

      const tracks = Array.isArray(rec?.tracks) ? rec.tracks : [];
      
      if (!tracks.length) {
        throw new Error(
          `Spotify 404: No recommendations found for ${workout}`
        );
      }

      // Get IDs for audio feature lookup
      const ids = tracks.map(t => t.id).filter(Boolean);
      let featuresById = {};
      
      try {
        featuresById = await this.#fetchAudioFeatures(ids);
      } catch (error) {
        console.warn("Audio features fetch failed, continuing without BPM data", error);
      }

      // Normalize to the shape your app expects
      return tracks.map(t => ({
        id: t.id,
        name: t.name,
        artist: (t.artists || []).map(a => a.name).join(", "),
        bpm: featuresById[t.id]?.tempo ?? target, // fallback to target tempo
        durationMs: t.duration_ms ?? 210000, // 3.5 min fallback
        workout,
        spotifyUri: t.uri,
        previewUrl: t.preview_url,
        externalUrl: t.external_urls?.spotify
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Randomly select genres from the available list
   * @private
   */
  #getRandomGenres(genres, count) {
    const shuffled = [...genres].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, 5)); // Spotify allows max 5 seeds
  }

  /**
   * Fetch audio features (including tempo/BPM) for tracks
   * @private
   */
  async #fetchAudioFeatures(ids) {
    if (!ids.length) return {};
    
    // API allows up to 100 ids per request
    const chunk = ids.slice(0, 100);
    const data = await this.#fetchJSON(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`
    );
    
    const out = {};
    for (const f of data?.audio_features ?? []) {
      if (f && f.id) {
        out[f.id] = { 
          tempo: typeof f.tempo === 'number' ? f.tempo : null 
        };
      }
    }
    return out;
  }

  /**
   * Fetch JSON from Spotify API with authorization
   * @private
   */
  async #fetchJSON(url) {
    const resp = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!resp.ok) {
      const msg = await resp.text();
      let friendlyMsg = msg;
      
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) {
          friendlyMsg = parsed.error.message;
        }
      } catch {
        // Ignore JSON parse errors
      }
      
      throw new Error(`Spotify ${resp.status}: ${friendlyMsg || msg}`);
    }
    
    return resp.json();
  }
}
