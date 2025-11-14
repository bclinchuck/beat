// Simple interface/abstract base for polymorphism
export class TrackProvider {
  /**
   * @param {string} workout  - one of: cardio|strength|yoga|hiit|warmup|cooldown
   * @returns {Promise<Array<{id:string,name:string,artist:string,bpm:number|null,durationMs:number|null,uri?:string}>>}
   */
  async getRecommendations(workout) {
    throw new Error("Not implemented");
  }
}
