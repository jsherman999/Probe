/**
 * Modal for configuring and adding an AI bot player
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOllama, generateBotNameFromModel } from '../hooks/useOllama';
import { BotConfig, getBotPresets, BotPreset } from '../services/botApi';
import Modal from './Modal';

interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: BotConfig) => void;
}

export default function BotConfigModal({ isOpen, onClose, onAdd }: BotConfigModalProps) {
  const navigate = useNavigate();
  const { combinedModels, isLoading, error, refresh, getProviderForModel } = useOllama();

  const [displayName, setDisplayName] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [personality, setPersonality] = useState('');
  const [presets, setPresets] = useState<BotPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [selectedPresetIcon, setSelectedPresetIcon] = useState<string | null>(null);

  // Load presets on mount
  useEffect(() => {
    if (isOpen) {
      getBotPresets()
        .then(setPresets)
        .catch(() => setPresets([]));
    }
  }, [isOpen]);

  // Helper to get full model string with size for name generation
  const getModelWithSize = (modelName: string): string => {
    const model = combinedModels.find(m => m.name === modelName);
    return model ? `${model.name} (${model.sizeFormatted})` : modelName;
  };

  // Auto-select first model if available and set default name
  useEffect(() => {
    if (combinedModels.length > 0 && !selectedModel) {
      const firstModel = combinedModels[0];
      setSelectedModel(firstModel.name);
      setDisplayName(generateBotNameFromModel(`${firstModel.name} (${firstModel.sizeFormatted})`));
    }
  }, [combinedModels, selectedModel]);

  // Handle model selection change - always generate new name
  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    if (modelName) {
      setDisplayName(generateBotNameFromModel(getModelWithSize(modelName)));
    }
  };

  // Load preset values when selected
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setDisplayName(preset.displayName);
      setSelectedModel(preset.modelName);
      setDifficulty(preset.difficulty as 'easy' | 'medium' | 'hard');
      setPersonality(preset.personality || '');
      setTemperature(preset.ollamaConfig?.temperature || 0.7);
      setSelectedPresetIcon(preset.iconSvg || null);
    } else {
      setSelectedPresetIcon(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedModel) return;

    const provider = getProviderForModel(selectedModel);
    const config: BotConfig = {
      displayName: displayName.trim() || generateBotNameFromModel(selectedModel),
      modelName: selectedModel,
      difficulty,
      provider,
      personality: personality.trim() || undefined,
      ollamaOptions: {
        temperature,
      },
    };

    onAdd(config);
    resetForm();
  };

  const resetForm = () => {
    const firstModel = combinedModels[0];
    if (firstModel) {
      setSelectedModel(firstModel.name);
      setDisplayName(generateBotNameFromModel(`${firstModel.name} (${firstModel.sizeFormatted})`));
    } else {
      setSelectedModel('');
      setDisplayName('');
    }
    setDifficulty('medium');
    setShowAdvanced(false);
    setTemperature(0.7);
    setPersonality('');
    setSelectedPreset('');
    setSelectedPresetIcon(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const difficultyDescriptions = {
    easy: 'Makes mistakes, uses common words',
    medium: 'Balanced play style',
    hard: 'Strategic choices, uncommon words',
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add AI Player">
      <div className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Cannot connect to Ollama</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={refresh}
              className="text-sm underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading models...</span>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Model Selection - TOP FIELD */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a model...</option>
                {combinedModels.map(model => (
                  <option key={`${model.provider}-${model.name}`} value={model.name}>
                    {model.displayLabel}
                  </option>
                ))}
              </select>
              {combinedModels.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No models found. Run <code className="bg-gray-100 px-1">ollama pull llama3.2</code> for local models or configure OpenRouter API key.
                </p>
              )}
            </div>

            {/* Bot Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Auto-generated from model..."
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-generated from model selection.
              </p>
            </div>

            {/* Saved Bots / Presets - Now shown first */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  {presets.length > 0 ? 'Quick Add Saved Bot' : 'Saved Bots'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigate('/bot-creator');
                  }}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  + Create New Bot
                </button>
              </div>
              {presets.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-md border transition-colors text-left ${
                        selectedPreset === preset.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        {preset.iconSvg ? (
                          <div
                            className="w-6 h-6"
                            dangerouslySetInnerHTML={{ __html: preset.iconSvg }}
                          />
                        ) : (
                          <span className="text-lg">🤖</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{preset.displayName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {preset.difficulty} · {preset.modelName.split(':')[0]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-2">
                  No saved bots. <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      navigate('/bot-creator');
                    }}
                    className="text-blue-500 hover:underline"
                  >
                    Create one
                  </button> to quickly add bots to games.
                </div>
              )}
            </div>

            {/* Divider */}
            {presets.length > 0 && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-500">or configure manually</span>
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 px-3 rounded-md border transition-colors ${
                      difficulty === d
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {difficultyDescriptions[difficulty]}
              </p>
            </div>

            {/* Advanced Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-md">
                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature: {temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>

                {/* Personality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personality (optional)
                  </label>
                  <textarea
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    placeholder="e.g., 'Aggressive player who takes risks' or 'Cautious and methodical'"
                    rows={2}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedModel}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add Bot
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
