import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../game/ScoringEngine';

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  describe('getPositionPoints', () => {
    it('should award 5 points for positions 0, 3, 6...', () => {
      expect(engine.getPositionPoints(0)).toBe(5);
      expect(engine.getPositionPoints(3)).toBe(5);
      expect(engine.getPositionPoints(6)).toBe(5);
    });

    it('should award 10 points for positions 1, 4, 7...', () => {
      expect(engine.getPositionPoints(1)).toBe(10);
      expect(engine.getPositionPoints(4)).toBe(10);
      expect(engine.getPositionPoints(7)).toBe(10);
    });

    it('should award 15 points for positions 2, 5, 8...', () => {
      expect(engine.getPositionPoints(2)).toBe(15);
      expect(engine.getPositionPoints(5)).toBe(15);
      expect(engine.getPositionPoints(8)).toBe(15);
    });

    it('should repeat the 5/10/15 pattern for long words', () => {
      expect(engine.getPositionPoints(11)).toBe(15); // 11 % 3 = 2
    });
  });

  describe('calculateScore', () => {
    it('should sum position values for revealed positions', () => {
      expect(engine.calculateScore([0])).toBe(5);
      expect(engine.calculateScore([1])).toBe(10);
      expect(engine.calculateScore([2])).toBe(15);
    });

    it('should handle multiple positions', () => {
      // Positions 0, 2, 5 -> 5 + 15 + 15 = 35
      expect(engine.calculateScore([0, 2, 5])).toBe(35);
    });

    it('should return 0 for no revealed positions', () => {
      expect(engine.calculateScore([])).toBe(0);
    });

    it('should score a fully revealed 7-letter word at 65', () => {
      // [5,10,15,5,10,15,5] = 65
      const positions = [0, 1, 2, 3, 4, 5, 6];
      expect(engine.calculateScore(positions)).toBe(65);
    });
  });

  describe('getPositionPointsArray', () => {
    it('should return the repeating pattern for a word length', () => {
      expect(engine.getPositionPointsArray(3)).toEqual([5, 10, 15]);
      expect(engine.getPositionPointsArray(7)).toEqual([5, 10, 15, 5, 10, 15, 5]);
    });

    it('should return an empty array for length 0', () => {
      expect(engine.getPositionPointsArray(0)).toEqual([]);
    });
  });

  describe('calculateScoreLegacy', () => {
    it('should use the average position value (10) per occurrence', () => {
      expect(engine.calculateScoreLegacy('E', 1)).toBe(10);
      expect(engine.calculateScoreLegacy('Q', 3)).toBe(30);
    });
  });

  describe('word completion bonus', () => {
    it('should expose a 50-point completion bonus constant', () => {
      expect(engine.WORD_COMPLETION_BONUS).toBe(50);
    });
  });
});
