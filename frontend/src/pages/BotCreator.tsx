/**
 * Bot Creator - Create and save custom bot configurations
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOllama } from '../hooks/useOllama';
import {
  generateRobotIcons,
  checkRobotIconHealth,
  createBotPreset,
  getBotPresets,
  deleteBotPreset,
  BotPreset,
} from '../services/botApi';

export default function BotCreator() {
  const navigate = useNavigate();
  const { combinedModels, isLoading: modelsLoading, error: modelsError, refresh } = useOllama();

  // Icon state
  const [icons, setIcons] = useState<string[]>([]);
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [iconLoading, setIconLoading] = useState(false);
  const [iconApiAvailable, setIconApiAvailable] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(40);
  const [personality, setPersonality] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Saved bots
  const [savedBots, setSavedBots] = useState<BotPreset[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check icon API health and load initial icons
  useEffect(() => {
    const init = async () => {
      const health = await checkRobotIconHealth();
      setIconApiAvailable(health.available);
      if (health.available) {
        loadNewIcons();
      }
      // Load saved bots
      try {
        const presets = await getBotPresets();
        setSavedBots(presets);
      } catch {
        // Ignore
      }
    };
    init();
  }, []);

  // Auto-select first model
  useEffect(() => {
    if (combinedModels.length > 0 && !selectedModel) {
      setSelectedModel(combinedModels[0].name);
    }
  }, [combinedModels, selectedModel]);

  const loadNewIcons = useCallback(async () => {
    setIconLoading(true);
    try {
      const newIcons = await generateRobotIcons(10);
      setIcons(newIcons);
      setCurrentIconIndex(0);
    } catch (err) {
      console.error('Failed to load icons:', err);
    } finally {
      setIconLoading(false);
    }
  }, []);

  const nextIcon = () => {
    if (icons.length > 0) {
      setCurrentIconIndex((prev) => (prev + 1) % icons.length);
    }
  };

  const prevIcon = () => {
    if (icons.length > 0) {
      setCurrentIconIndex((prev) => (prev - 1 + icons.length) % icons.length);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Please enter a name for your bot');
      return;
    }
    if (!selectedModel) {
      setSaveError('Please select a model');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const model = combinedModels.find((m) => m.name === selectedModel);
      const preset = await createBotPreset({
        presetName: name.trim(),
        displayName: name.trim(),
        modelName: selectedModel,
        difficulty,
        provider: model?.provider || 'ollama',
        personality: personality.trim() || undefined,
        iconSvg: icons[currentIconIndex] || undefined,
        ollamaConfig: {
          temperature,
          top_p: topP,
          top_k: topK,
        },
      });

      setSavedBots((prev) => [preset, ...prev]);
      setSaveSuccess(true);

      // Reset form
      setName('');
      setPersonality('');
      loadNewIcons();

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setSaveError('A bot with this name already exists');
      } else {
        setSaveError(err.message || 'Failed to save bot');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      await deleteBotPreset(id);
      setSavedBots((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Failed to delete bot:', err);
    }
  };

  const difficultyInfo = {
    easy: { label: 'Easy', desc: 'Makes mistakes, uses common words', color: 'bg-green-500' },
    medium: { label: 'Medium', desc: 'Balanced play style', color: 'bg-yellow-500' },
    hard: { label: 'Hard', desc: 'Strategic choices, uncommon words', color: 'bg-red-500' },
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back
            </button>
            <h1 className="text-2xl font-bold">Bot Creator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Bot Configuration */}
          <div className="space-y-6">
            {/* Icon Selector */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Bot Avatar</h2>

              {!iconApiAvailable ? (
                <div className="text-center py-8 text-gray-400">
                  <p>Robot icon generator not available</p>
                  <p className="text-sm mt-2">Make sure the robot API is running on port 9009</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {/* Icon Display */}
                  <div className="relative w-32 h-32 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                    {iconLoading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    ) : icons.length > 0 ? (
                      <div
                        className="w-24 h-24"
                        dangerouslySetInnerHTML={{ __html: icons[currentIconIndex] }}
                      />
                    ) : (
                      <div className="text-gray-500">No icon</div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={prevIcon}
                      disabled={icons.length === 0 || iconLoading}
                      className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &larr;
                    </button>
                    <span className="text-sm text-gray-400">
                      {icons.length > 0 ? `${currentIconIndex + 1} / ${icons.length}` : '-'}
                    </span>
                    <button
                      onClick={nextIcon}
                      disabled={icons.length === 0 || iconLoading}
                      className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &rarr;
                    </button>
                  </div>

                  {/* Generate More */}
                  <button
                    onClick={loadNewIcons}
                    disabled={iconLoading}
                    className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {iconLoading ? 'Generating...' : 'Generate New Icons'}
                  </button>
                </div>
              )}
            </div>

            {/* Basic Configuration */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Configuration</h2>

              {/* Bot Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bot Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a unique name..."
                  maxLength={30}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
              </div>

              {/* Model Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  AI Model <span className="text-red-400">*</span>
                </label>
                {modelsLoading ? (
                  <div className="flex items-center py-2 text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
                    Loading models...
                  </div>
                ) : modelsError ? (
                  <div className="text-red-400 text-sm">
                    {modelsError}
                    <button onClick={refresh} className="ml-2 underline">
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                  >
                    <option value="">Select a model...</option>
                    {combinedModels.map((model) => (
                      <option key={`${model.provider}-${model.name}`} value={model.name}>
                        {model.displayLabel}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Difficulty */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                        difficulty === d
                          ? `${difficultyInfo[d].color} text-white border-transparent`
                          : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      {difficultyInfo[d].label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-400 mt-1">{difficultyInfo[difficulty].desc}</p>
              </div>

              {/* Advanced Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
              >
                {showAdvanced ? '▼' : '▶'} Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-gray-700/50 rounded-lg">
                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
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
                    <p className="text-xs text-gray-400">
                      Lower = more focused, Higher = more creative
                    </p>
                  </div>

                  {/* Top P */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Top P: {topP.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-400">Nucleus sampling threshold</p>
                  </div>

                  {/* Top K */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Top K: {topK}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-400">Number of tokens to consider</p>
                  </div>

                  {/* Personality */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Personality (optional)
                    </label>
                    <textarea
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      placeholder="e.g., 'Aggressive player who takes risks' or 'Cautious and methodical'"
                      rows={2}
                      maxLength={500}
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="bg-gray-800 rounded-lg p-6">
              {saveError && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {saveError}
                </div>
              )}
              {saveSuccess && (
                <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm">
                  Bot saved successfully!
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !selectedModel}
                className="w-full py-3 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {saving ? 'Saving...' : 'Save Bot'}
              </button>
            </div>
          </div>

          {/* Right Column - Saved Bots */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              Saved Bots ({savedBots.length})
            </h2>

            {savedBots.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No saved bots yet</p>
                <p className="text-sm mt-2">Create your first bot using the form</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {savedBots.map((bot) => (
                  <div
                    key={bot.id}
                    className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg"
                  >
                    {/* Bot Icon */}
                    <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      {bot.iconSvg ? (
                        <div
                          className="w-10 h-10"
                          dangerouslySetInnerHTML={{ __html: bot.iconSvg }}
                        />
                      ) : (
                        <span className="text-2xl">🤖</span>
                      )}
                    </div>

                    {/* Bot Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{bot.displayName}</h3>
                      <p className="text-sm text-gray-400 truncate">{bot.modelName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            difficultyInfo[bot.difficulty as keyof typeof difficultyInfo]?.color ||
                            'bg-gray-500'
                          }`}
                        >
                          {bot.difficulty}
                        </span>
                        <span className="text-xs text-gray-500">
                          {bot.provider === 'openrouter' ? 'remote' : 'local'}
                        </span>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(bot.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete bot"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
