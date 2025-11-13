// Simple interface/abstract base for polymorphism
export class TrackProvider {
  /**
   * @param {number} bpm      - current heart rate
   * @param {string} workout  - one of: cardio|strength|yoga|hiit|warmup|cooldown
   * @returns {Promise<Array<{id:string,name:string,artist:string,bpm:number|null,durationMs:number|null}>>}
   */
  async getRecommendations(bpm, workout) {
    throw new Error("Not implemented");
  }
}
