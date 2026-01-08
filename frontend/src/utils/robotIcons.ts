/**
 * Robot icon utilities for bot players
 * Assigns consistent robot icons based on botId hash
 */

// List of available robot icons (30 total from 3 galleries)
export const ROBOT_ICONS = [
  // Original Gallery (1-10)
  { id: 1, name: 'Classic Bot', src: '/robots/robot-1-classic.svg' },
  { id: 2, name: 'Cute Bot', src: '/robots/robot-2-cute.svg' },
  { id: 3, name: 'Geometric Bot', src: '/robots/robot-3-geometric.svg' },
  { id: 4, name: 'Minimalist Bot', src: '/robots/robot-4-minimalist.svg' },
  { id: 5, name: 'Rounded Bot', src: '/robots/robot-5-rounded.svg' },
  { id: 6, name: 'Antenna Bot', src: '/robots/robot-6-antenna.svg' },
  { id: 7, name: 'Retro Bot', src: '/robots/robot-7-retro.svg' },
  { id: 8, name: 'Blocky Bot', src: '/robots/robot-8-blocky.svg' },
  { id: 9, name: 'Friendly Bot', src: '/robots/robot-9-friendly.svg' },
  { id: 10, name: 'Sparkle Bot', src: '/robots/robot-10-sparkle.svg' },
  // Gallery V2 (11-20)
  { id: 11, name: 'Cyborg Bot', src: '/robots/robot-11-cyborg.svg' },
  { id: 12, name: 'Steampunk Bot', src: '/robots/robot-12-steampunk.svg' },
  { id: 13, name: 'Ninja Bot', src: '/robots/robot-13-ninja.svg' },
  { id: 14, name: 'Chef Bot', src: '/robots/robot-14-chef.svg' },
  { id: 15, name: 'Astronaut Bot', src: '/robots/robot-15-astronaut.svg' },
  { id: 16, name: 'DJ Bot', src: '/robots/robot-16-dj.svg' },
  { id: 17, name: 'Wizard Bot', src: '/robots/robot-17-wizard.svg' },
  { id: 18, name: 'Sports Bot', src: '/robots/robot-18-sports.svg' },
  { id: 19, name: 'Pirate Bot', src: '/robots/robot-19-pirate.svg' },
  { id: 20, name: 'Garden Bot', src: '/robots/robot-20-garden.svg' },
  // Gallery V3 (21-30)
  { id: 21, name: 'Scientist Bot', src: '/robots/robot-21-scientist.svg' },
  { id: 22, name: 'Artist Bot', src: '/robots/robot-22-artist.svg' },
  { id: 23, name: 'Detective Bot', src: '/robots/robot-23-detective.svg' },
  { id: 24, name: 'Musician Bot', src: '/robots/robot-24-musician.svg' },
  { id: 25, name: 'Superhero Bot', src: '/robots/robot-25-superhero.svg' },
  { id: 26, name: 'Viking Bot', src: '/robots/robot-26-viking.svg' },
  { id: 27, name: 'Samurai Bot', src: '/robots/robot-27-samurai.svg' },
  { id: 28, name: 'Explorer Bot', src: '/robots/robot-28-explorer.svg' },
  { id: 29, name: 'Doctor Bot', src: '/robots/robot-29-doctor.svg' },
  { id: 30, name: 'Disco Bot', src: '/robots/robot-30-disco.svg' },
];

/**
 * Simple hash function to convert a string to a number
 * Used to consistently assign the same robot to the same botId
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a robot icon for a bot based on their botId
 * The same botId will always return the same robot icon
 */
export function getRobotIcon(botId: string): typeof ROBOT_ICONS[0] {
  const index = hashString(botId) % ROBOT_ICONS.length;
  return ROBOT_ICONS[index];
}

/**
 * Get just the robot icon URL for a bot
 */
export function getRobotIconUrl(botId: string): string {
  return getRobotIcon(botId).src;
}

/**
 * Get a random robot icon (for preview purposes)
 */
export function getRandomRobotIcon(): typeof ROBOT_ICONS[0] {
  const index = Math.floor(Math.random() * ROBOT_ICONS.length);
  return ROBOT_ICONS[index];
}
