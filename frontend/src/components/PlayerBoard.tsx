import { getRobotIconUrl } from '../utils/robotIcons';

interface PlayerBoardProps {
  playerName: string;
  score: number;
  word: (string | null)[];
  isActive: boolean;
  isTarget: boolean;
  isEliminated: boolean;
  isCurrentUser: boolean;
  isBot?: boolean;
  botId?: string;
  botModelName?: string;
  onClick?: () => void;
}

export default function PlayerBoard({
  playerName,
  score,
  word,
  isActive,
  isTarget,
  isEliminated,
  isCurrentUser,
  isBot,
  botId,
  botModelName,
  onClick,
}: PlayerBoardProps) {
  // Get robot icon URL for bots
  const robotIconUrl = isBot && botId ? getRobotIconUrl(botId) : null;
  return (
    <div
      onClick={onClick}
      className={`
        card transition-all cursor-pointer
        ${isTarget ? 'ring-4 ring-warning shadow-xl' : ''}
        ${isActive ? 'ring-2 ring-player-active' : ''}
        ${isEliminated ? 'opacity-50' : ''}
        ${onClick && !isEliminated ? 'hover:ring-2 hover:ring-accent' : ''}
        ${isBot ? 'border-l-4 border-l-cyan-500' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="font-bold text-lg flex items-center gap-2">
            {isBot && robotIconUrl && (
              <span className="w-6 h-6 flex-shrink-0" title="AI Player">
                <img src={robotIconUrl} alt="Bot" className="w-full h-full object-contain" />
              </span>
            )}
            {playerName} {isCurrentUser && '(You)'}
            {isBot && (
              <span className="px-1.5 py-0.5 text-xs bg-cyan-600/30 text-cyan-400 rounded font-normal">
                AI
              </span>
            )}
          </p>
          {isBot && botModelName && (
            <span className="text-xs text-cyan-400/70">{botModelName}</span>
          )}
          {isEliminated && (
            <span className="text-xs text-player-eliminated">Eliminated</span>
          )}
          {isActive && !isEliminated && !isBot && (
            <span className="text-xs text-player-active">• Active Turn</span>
          )}
          {isActive && !isEliminated && isBot && (
            <span className="text-xs text-cyan-400 animate-pulse">• AI Thinking...</span>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent">{score}</p>
          <p className="text-xs text-text-muted">points</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {word.map((letter, i) => (
          <div
            key={i}
            className={`
              w-10 h-10 md:w-12 md:h-12
              flex items-center justify-center
              text-xl md:text-2xl font-bold
              border-2 rounded transition-all
              ${letter 
                ? 'bg-tile-revealed border-tile-border text-primary-bg' 
                : 'bg-tile-concealed border-tile-border'
              }
            `}
          >
            {letter || ''}
          </div>
        ))}
      </div>
    </div>
  );
}
