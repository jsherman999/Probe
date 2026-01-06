/**
 * Robot icon utilities for bot players
 * Assigns consistent robot icons based on botId hash
 */

// List of available robot icons
export const ROBOT_ICONS = [
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
