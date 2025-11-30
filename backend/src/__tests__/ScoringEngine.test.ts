import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../game/ScoringEngine';

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();

  it('should calculate score for 1-point letters', () => {
    expect(engine.calculateScore('E', 1)).toBe(1);
    expect(engine.calculateScore('A', 2)).toBe(2);
    expect(engine.calculateScore('I', 3)).toBe(3);
  });

  it('should calculate score for 2-point letters', () => {
    expect(engine.calculateScore('D', 1)).toBe(2);
    expect(engine.calculateScore('G', 2)).toBe(4);
  });

  it('should calculate score for 3-point letters', () => {
    expect(engine.calculateScore('B', 1)).toBe(3);
    expect(engine.calculateScore('C', 2)).toBe(6);
  });

  it('should calculate score for 4-point letters', () => {
    expect(engine.calculateScore('F', 1)).toBe(4);
    expect(engine.calculateScore('H', 2)).toBe(8);
  });

  it('should calculate score for 5-point letters', () => {
    expect(engine.calculateScore('K', 1)).toBe(5);
    expect(engine.calculateScore('K', 2)).toBe(10);
  });

  it('should calculate score for 8-point letters', () => {
    expect(engine.calculateScore('J', 1)).toBe(8);
    expect(engine.calculateScore('X', 2)).toBe(16);
  });

  it('should calculate score for 10-point letters', () => {
    expect(engine.calculateScore('Q', 1)).toBe(10);
    expect(engine.calculateScore('Z', 2)).toBe(20);
  });

  it('should return 0 for unknown letters', () => {
    expect(engine.calculateScore('1', 1)).toBe(0);
    expect(engine.calculateScore('$', 1)).toBe(0);
  });

  it('should handle lowercase letters', () => {
    expect(engine.calculateScore('e', 1)).toBe(1);
    expect(engine.calculateScore('z', 1)).toBe(10);
  });

  it('should get correct letter value', () => {
    expect(engine.getLetterValue('E')).toBe(1);
    expect(engine.getLetterValue('Q')).toBe(10);
    expect(engine.getLetterValue('K')).toBe(5);
  });

  it('should return all letter values', () => {
    const values = engine.getAllLetterValues();
    expect(values.size).toBeGreaterThan(0);
    expect(values.get('E')).toBe(1);
    expect(values.get('Z')).toBe(10);
  });
});
