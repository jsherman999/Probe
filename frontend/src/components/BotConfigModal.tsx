/**
 * Modal for selecting a saved bot to add as an AI player
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BotConfig, getBotPresets, BotPreset } from '../services/botApi';
import Modal from './Modal';

interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: BotConfig) => void;
}

export default function BotConfigModal({ isOpen, onClose, onAdd }: BotConfigModalProps) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<BotPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Load presets on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getBotPresets()
        .then(setPresets)
        .catch(() => setPresets([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSelectBot = (preset: BotPreset) => {
    const config: BotConfig = {
      displayName: preset.displayName,
      modelName: preset.modelName,
      difficulty: preset.difficulty as 'easy' | 'medium' | 'hard',
      provider: (preset.provider as 'ollama' | 'openrouter') || 'ollama',
      personality: preset.personality || undefined,
      ollamaOptions: {
        temperature: preset.ollamaConfig?.temperature || 0.7,
        top_p: preset.ollamaConfig?.top_p,
        top_k: preset.ollamaConfig?.top_k,
      },
    };

    onAdd(config);
    onClose();
  };

  const handleGoToCreator = () => {
    onClose();
    navigate('/bot-creator');
  };

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500',
    medium: 'bg-yellow-500',
    hard: 'bg-red-500',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add AI Player">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading bots...</span>
          </div>
        ) : presets.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Saved Bots</h3>
            <p className="text-gray-600 mb-4">
              Create your first bot in the Bot Creator to add AI players to your games.
            </p>
            <button
              onClick={handleGoToCreator}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Go to Bot Creator
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Select a saved bot to add to the game:
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectBot(preset)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300 transition-colors text-left"
                >
                  {/* Icon */}
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {preset.iconSvg ? (
                      <div
                        className="w-10 h-10"
                        dangerouslySetInnerHTML={{ __html: preset.iconSvg }}
                      />
                    ) : (
                      <span className="text-2xl">🤖</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {preset.displayName}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {preset.modelName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs text-white ${
                          difficultyColors[preset.difficulty] || 'bg-gray-500'
                        }`}
                      >
                        {preset.difficulty}
                      </span>
                      <span className="text-xs text-gray-400">
                        {preset.provider === 'openrouter' ? 'remote' : 'local'}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-400">
                    →
                  </div>
                </button>
              ))}
            </div>

            {/* Link to create more */}
            <div className="pt-4 border-t border-gray-200 text-center">
              <button
                onClick={handleGoToCreator}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                + Create New Bot in Bot Creator
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
