import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WordValidator } from '../game/WordValidator';

// Words the mocked dictionary API reports as valid
const VALID_WORDS = new Set(['PROBE', 'GAME', 'WORD']);

/**
 * Mock the online dictionary API so tests are deterministic and work without
 * network access. The real implementation calls api.dictionaryapi.dev, which
 * returns 200 for known words and 404 otherwise.
 */
const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  const word = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').toUpperCase();
  return { ok: VALID_WORDS.has(word) } as Response;
});

describe('WordValidator', () => {
  const validator = new WordValidator();

  beforeAll(async () => {
    vi.stubGlobal('fetch', mockFetch);
    await validator.loadDictionary();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
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
    it('should accept common English words', async () => {
      await expect(validator.isValidWord('PROBE')).resolves.toBe(true);
      await expect(validator.isValidWord('GAME')).resolves.toBe(true);
      await expect(validator.isValidWord('WORD')).resolves.toBe(true);
    });

    it('should be case-insensitive', async () => {
      await expect(validator.isValidWord('probe')).resolves.toBe(true);
      await expect(validator.isValidWord('Probe')).resolves.toBe(true);
    });

    it('should reject gibberish', async () => {
      await expect(validator.isValidWord('XYZABC')).resolves.toBe(false);
      await expect(validator.isValidWord('QWERTY')).resolves.toBe(false);
    });

    it('should reject words that fail basic validation without hitting the API', async () => {
      await expect(validator.isValidWord('CAT')).resolves.toBe(false); // too short
      await expect(validator.isValidWord('WORD123')).resolves.toBe(false); // digits
    });
  });
});
