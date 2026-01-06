/**
 * Card component for displaying a bot player in the lobby
 */
import { getRobotIconUrl } from '../utils/robotIcons';

interface BotPlayerCardProps {
  botId: string;
  displayName: string;
  modelName?: string;
  difficulty?: string;
  canRemove: boolean;
  onRemove: () => void;
}

export default function BotPlayerCard({
  botId,
  displayName,
  modelName,
  difficulty,
  canRemove,
  onRemove,
}: BotPlayerCardProps) {
  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  };

  // Get consistent robot icon based on botId
  const robotIconUrl = getRobotIconUrl(botId);

  return (
    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center gap-3">
        {/* Robot Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center p-1 overflow-hidden">
          <img
            src={robotIconUrl}
            alt={`${displayName} robot icon`}
            className="w-full h-full object-contain"
          />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{displayName}</span>
            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded">
              AI
            </span>
            {difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded ${difficultyColors[difficulty as keyof typeof difficultyColors] || 'bg-gray-100 text-gray-700'}`}>
                {difficulty}
              </span>
            )}
          </div>
          {modelName && (
            <p className="text-xs text-gray-500">{modelName}</p>
          )}
        </div>
      </div>

      {canRemove && (
        <button
          onClick={onRemove}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
          title="Remove bot"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
