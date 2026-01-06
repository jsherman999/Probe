/**
 * Modal for configuring and adding an AI bot player
 */

import { useState, useEffect } from 'react';
import { useOllama } from '../hooks/useOllama';
import { BotConfig, getBotPresets, BotPreset, LLMProvider } from '../services/botApi';
import Modal from './Modal';

interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (config: BotConfig) => void;
}

export default function BotConfigModal({ isOpen, onClose, onAdd }: BotConfigModalProps) {
  const { models, isLoading, error, refresh, provider, setProvider } = useOllama();

  const [displayName, setDisplayName] = useState('Bot Player');
  const [selectedModel, setSelectedModel] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [personality, setPersonality] = useState('');
  const [presets, setPresets] = useState<BotPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Load presets on mount
  useEffect(() => {
    if (isOpen) {
      getBotPresets()
        .then(setPresets)
        .catch(() => setPresets([]));
    }
  }, [isOpen]);

  // Auto-select first model if available
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].name);
    }
  }, [models, selectedModel]);

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
    }
  };

  const handleSubmit = () => {
    if (!selectedModel) return;

    const config: BotConfig = {
      displayName: displayName.trim() || 'Bot Player',
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

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setSelectedModel(''); // Clear model selection when switching providers
  };

  const resetForm = () => {
    setDisplayName('Bot Player');
    setSelectedModel(models[0]?.name || '');
    setDifficulty('medium');
    setShowAdvanced(false);
    setTemperature(0.7);
    setPersonality('');
    setSelectedPreset('');
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
            {/* Provider Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Provider
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleProviderChange('ollama')}
                  className={`flex-1 py-2 px-3 rounded-md border transition-colors ${
                    provider === 'ollama'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  🖥️ Local (Ollama)
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderChange('openrouter')}
                  className={`flex-1 py-2 px-3 rounded-md border transition-colors ${
                    provider === 'openrouter'
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ☁️ Cloud (OpenRouter)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {provider === 'ollama'
                  ? 'Uses local Ollama server for AI responses'
                  : 'Uses OpenRouter cloud API (free models only)'}
              </p>
            </div>

            {/* Presets */}
            {presets.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Load from Preset
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Custom Configuration --</option>
                  {presets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.presetName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Bot Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter bot name..."
                maxLength={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a model...</option>
                {models.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.sizeFormatted})
                  </option>
                ))}
              </select>
              {models.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {provider === 'ollama'
                    ? <>No models found. Run <code className="bg-gray-100 px-1">ollama pull llama3.2</code> to download a model.</>
                    : 'No free models available from OpenRouter.'}
                </p>
              )}
            </div>

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
