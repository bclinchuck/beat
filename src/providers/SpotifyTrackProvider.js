import { TrackProvider } from "./TrackProvider.js";

/**
 * Spotify Web API wrapper for Recommendations + Audio Features.
 * Fetches random songs based on workout type, genres, and tempo ranges.
 * NO hardcoded seed tracks or artists - just genres!
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
   * Uses ONLY genres, no seed tracks/artists
   * @param {string} workout - one of: cardio|strength|yoga|hiit|warmup|cooldown
   * @returns {Promise<Array>} Array of random track objects
   */
  async getRecommendations(workout) {
    console.log(`[Spotify] Fetching recommendations for workout: ${workout}`);
    
    const config = WORKOUT_CONFIG[workout] || WORKOUT_CONFIG.cardio;
    const { genres, tempo } = config;
    const { min, target, max } = tempo;

    console.log(`[Spotify] Tempo range: ${min}-${max} (target: ${target})`);

    // Randomly select 1-3 genres for variety
    const selectedGenres = this.#getRandomGenres(genres, 3);
    console.log(`[Spotify] Selected genres: ${selectedGenres.join(", ")}`);

    // Build params with ONLY genres (no seed_tracks or seed_artists)
    const params = new URLSearchParams({
      limit: "20",
      market: "US",
      seed_genres: selectedGenres.join(","),
      target_tempo: String(target),
      min_tempo: String(min),
      max_tempo: String(max),
      min_energy: "0.3",
      min_danceability: "0.3"
    });

    const url = `https://api.spotify.com/v1/recommendations?${params.toString()}`;
    console.log(`[Spotify] Request URL: ${url}`);

    try {
      const rec = await this.#fetchJSON(url);
      console.log(`[Spotify] Response received:`, rec);

      const tracks = Array.isArray(rec?.tracks) ? rec.tracks : [];
      console.log(`[Spotify] Found ${tracks.length} tracks`);
      
      if (!tracks.length) {
        throw new Error(
          `Spotify 404: No recommendations found for ${workout}`
        );
      }

      // Get IDs for audio feature lookup
      const ids = tracks.map(t => t.id).filter(Boolean);
      console.log(`[Spotify] Fetching audio features for ${ids.length} tracks`);
      
      let featuresById = {};
      
      try {
        featuresById = await this.#fetchAudioFeatures(ids);
        console.log(`[Spotify] Audio features fetched`, featuresById);
      } catch (error) {
        console.warn("Audio features fetch failed, continuing without BPM data", error);
      }

      // Normalize to the shape your app expects
      const result = tracks.map(t => ({
        id: t.id,
        name: t.name,
        artist: (t.artists || []).map(a => a.name).join(", "),
        bpm: featuresById[t.id]?.tempo ?? target,
        durationMs: t.duration_ms ?? 210000,
        workout,
        spotifyUri: t.uri,
        previewUrl: t.preview_url,
        externalUrl: t.external_urls?.spotify
      }));

      console.log(`[Spotify] Returning ${result.length} formatted tracks`);
      return result;
    } catch (error) {
      console.error(`[Spotify] Error in getRecommendations:`, error);
      throw error;
    }
  }

  /**
   * Randomly select genres from the available list
   * @private
   */
  #getRandomGenres(genres, count) {
    const shuffled = [...genres].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, 5)); // Spotify max 5 seeds
  }

  /**
   * Fetch audio features (including tempo/BPM) for tracks
   * @private
   */
  async #fetchAudioFeatures(ids) {
    if (!ids.length) return {};
    
    const chunk = ids.slice(0, 100);
    const url = `https://api.spotify.com/v1/audio-features?ids=${chunk.join(",")}`;
    console.log(`[Spotify] Fetching audio features from: ${url}`);
    
    const data = await this.#fetchJSON(url);
    
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
    console.log(`[Spotify] Fetching: ${url}`);
    
    const resp = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[Spotify] Response status: ${resp.status}`);
    
    if (!resp.ok) {
      const msg = await resp.text();
      console.error(`[Spotify] Error response: ${msg}`);
      
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
