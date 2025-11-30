import { describe, it, expect, beforeAll } from 'vitest';
import { WordValidator } from '../game/WordValidator';

describe('WordValidator', () => {
  const validator = new WordValidator();

  beforeAll(async () => {
    await validator.loadDictionary();
  });

  describe('isValidLength', () => {
    it('should accept words with 4-12 letters', () => {
      expect(validator.isValidLength('WORD')).toBe(true);
      expect(validator.isValidLength('EXAMPLE')).toBe(true);
      expect(validator.isValidLength('EXTRAORDINARY')).toBe(false);
    });

    it('should reject words too short', () => {
      expect(validator.isValidLength('CAT')).toBe(false);
      expect(validator.isValidLength('NO')).toBe(false);
    });

    it('should reject words too long', () => {
      expect(validator.isValidLength('EXTRAORDINARY')).toBe(false);
    });
  });

  describe('hasValidCharacters', () => {
    it('should accept only letter characters', () => {
      expect(validator.hasValidCharacters('PROBE')).toBe(true);
      expect(validator.hasValidCharacters('WORD')).toBe(true);
    });

    it('should reject numbers', () => {
      expect(validator.hasValidCharacters('WORD123')).toBe(false);
      expect(validator.hasValidCharacters('123WORD')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(validator.hasValidCharacters('WORD-GAME')).toBe(false);
      expect(validator.hasValidCharacters('WORD!')).toBe(false);
    });

    it('should reject spaces', () => {
      expect(validator.hasValidCharacters('WORD GAME')).toBe(false);
    });
  });

  describe('isValidWord', () => {
    it('should accept common English words', () => {
      expect(validator.isValidWord('PROBE')).toBe(true);
      expect(validator.isValidWord('GAME')).toBe(true);
      expect(validator.isValidWord('WORD')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(validator.isValidWord('probe')).toBe(true);
      expect(validator.isValidWord('Probe')).toBe(true);
      expect(validator.isValidWord('PROBE')).toBe(true);
    });

    it('should reject gibberish', () => {
      expect(validator.isValidWord('XYZABC')).toBe(false);
      expect(validator.isValidWord('QWERTY')).toBe(false);
    });
  });
});
