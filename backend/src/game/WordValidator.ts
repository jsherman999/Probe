import * as fs from 'fs';
import * as path from 'path';

export class WordValidator {
  private dictionary: Set<string> = new Set();
  private isLoaded = false;

  async loadDictionary(): Promise<void> {
    if (this.isLoaded) return;

    // For now, use a basic word list
    // In production, load from a proper dictionary file
    const commonWords = [
      'PROBE', 'GAME', 'WORD', 'PLAY', 'SCORE', 'LETTER', 'PLAYER', 'BOARD',
      'GUESS', 'TURN', 'ROUND', 'POINT', 'MATCH', 'WINNER', 'START', 'FINISH',
      'COMPLETE', 'REVEAL', 'HIDDEN', 'SECRET', 'CHALLENGE', 'COMPETE',
      'STRATEGY', 'PUZZLE', 'BRAIN', 'THINK', 'SMART', 'CLEVER', 'QUICK',
      'FAST', 'SLOW', 'EASY', 'HARD', 'DIFFICULT', 'SIMPLE', 'COMPLEX',
      'BASIC', 'ADVANCED', 'EXPERT', 'NOVICE', 'BEGINNER', 'MASTER',
      'CHAMPION', 'VICTORY', 'DEFEAT', 'SUCCESS', 'FAILURE', 'ATTEMPT',
      'HOUSE', 'MOUSE', 'COMPUTER', 'KEYBOARD', 'MONITOR', 'SCREEN',
      'WINDOW', 'DOOR', 'TABLE', 'CHAIR', 'DESK', 'LAMP', 'LIGHT',
      'DARK', 'BRIGHT', 'COLOR', 'BLACK', 'WHITE', 'GREEN', 'BLUE',
      'YELLOW', 'ORANGE', 'PURPLE', 'BROWN', 'GRAY', 'SILVER', 'GOLD',
      'DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'CRYSTAL',
      'WATER', 'FIRE', 'EARTH', 'WIND', 'STORM', 'RAIN', 'SNOW',
      'CLOUD', 'THUNDER', 'LIGHTNING', 'SUNSHINE', 'MOONLIGHT', 'STARLIGHT',
      'MOUNTAIN', 'VALLEY', 'RIVER', 'OCEAN', 'FOREST', 'DESERT',
      'ISLAND', 'BEACH', 'CASTLE', 'PALACE', 'TOWER', 'BRIDGE',
      'ROAD', 'PATH', 'TRAIL', 'JOURNEY', 'ADVENTURE', 'QUEST',
      'MISSION', 'TASK', 'PROJECT', 'WORK', 'JOB', 'CAREER',
      'BUSINESS', 'COMPANY', 'OFFICE', 'MEETING', 'CONFERENCE', 'PRESENTATION',
      'REPORT', 'DOCUMENT', 'FILE', 'FOLDER', 'ARCHIVE', 'DATABASE',
      'SYSTEM', 'NETWORK', 'SERVER', 'CLIENT', 'APPLICATION', 'SOFTWARE',
      'HARDWARE', 'DEVICE', 'MACHINE', 'ROBOT', 'ARTIFICIAL', 'INTELLIGENCE',
      'TECHNOLOGY', 'SCIENCE', 'MATHEMATICS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY',
      'HISTORY', 'GEOGRAPHY', 'LITERATURE', 'MUSIC', 'ART', 'CULTURE',
      'SOCIETY', 'COMMUNITY', 'FAMILY', 'FRIEND', 'NEIGHBOR', 'STRANGER',
      'PERSON', 'HUMAN', 'ANIMAL', 'PLANT', 'FLOWER', 'TREE',
      'FRUIT', 'VEGETABLE', 'FOOD', 'DRINK', 'MEAL', 'BREAKFAST',
      'LUNCH', 'DINNER', 'SNACK', 'DESSERT', 'CAKE', 'COOKIE',
      'BREAD', 'BUTTER', 'CHEESE', 'MILK', 'JUICE', 'COFFEE',
      'SEASON', 'SPRING', 'SUMMER', 'AUTUMN', 'WINTER', 'MONTH',
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE', 'JULY',
      'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'MONDAY',
      'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
      'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'MIDNIGHT', 'NOON',
      'CLOCK', 'WATCH', 'TIMER', 'ALARM', 'CALENDAR', 'SCHEDULE',
      'HAPPY', 'JOYFUL', 'EXCITED', 'PLEASED', 'CONTENT', 'SATISFIED',
      'PEACEFUL', 'CALM', 'QUIET', 'SILENT', 'LOUD', 'NOISY',
      'BEAUTIFUL', 'PRETTY', 'LOVELY', 'GORGEOUS', 'HANDSOME', 'ATTRACTIVE',
      'STRONG', 'POWERFUL', 'MIGHTY', 'BRAVE', 'COURAGEOUS', 'FEARLESS',
      'HONEST', 'TRUTHFUL', 'LOYAL', 'FAITHFUL', 'TRUSTWORTHY', 'RELIABLE',
      'KIND', 'GENTLE', 'CARING', 'LOVING', 'TENDER', 'COMPASSIONATE',
      'GENEROUS', 'GIVING', 'SHARING', 'HELPFUL', 'SUPPORTIVE', 'ENCOURAGING',
      'CREATIVE', 'INNOVATIVE', 'ORIGINAL', 'UNIQUE', 'SPECIAL', 'REMARKABLE',
      'EXCELLENT', 'OUTSTANDING', 'SUPERB', 'MAGNIFICENT', 'WONDERFUL', 'AMAZING',
      'FANTASTIC', 'INCREDIBLE', 'EXTRAORDINARY', 'EXCEPTIONAL', 'PERFECT', 'IDEAL',
    ];

    commonWords.forEach(word => this.dictionary.add(word.toUpperCase()));
    this.isLoaded = true;
  }

  isValidWord(word: string): boolean {
    return this.dictionary.has(word.toUpperCase());
  }

  isValidLength(word: string): boolean {
    const len = word.length;
    return len >= 4 && len <= 12;
  }

  hasValidCharacters(word: string): boolean {
    return /^[A-Z]+$/i.test(word);
  }
}
