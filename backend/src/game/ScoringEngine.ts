export class ScoringEngine {
  private letterValues: Map<string, number>;

  constructor() {
    this.letterValues = new Map([
      // 1 point letters
      ['E', 1], ['A', 1], ['I', 1], ['O', 1], ['N', 1],
      ['R', 1], ['T', 1], ['L', 1], ['S', 1], ['U', 1],
      
      // 2 point letters
      ['D', 2], ['G', 2],
      
      // 3 point letters
      ['B', 3], ['C', 3], ['M', 3], ['P', 3],
      
      // 4 point letters
      ['F', 4], ['H', 4], ['V', 4], ['W', 4], ['Y', 4],
      
      // 5 point letters
      ['K', 5],
      
      // 8 point letters
      ['J', 8], ['X', 8],
      
      // 10 point letters
      ['Q', 10], ['Z', 10],
    ]);
  }

  calculateScore(letter: string, occurrences: number): number {
    const value = this.getLetterValue(letter);
    return value * occurrences;
  }

  getLetterValue(letter: string): number {
    return this.letterValues.get(letter.toUpperCase()) || 0;
  }

  getAllLetterValues(): Map<string, number> {
    return new Map(this.letterValues);
  }
}
