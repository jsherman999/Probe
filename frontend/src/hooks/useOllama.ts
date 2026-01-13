/**
 * Hook for interacting with LLM providers (Ollama and OpenRouter)
 */

import { useState, useEffect, useCallback } from 'react';
import { getOllamaStatus, getOllamaModels, OllamaModel, OllamaStatus, LLMProvider } from '../services/botApi';

interface UseOllamaReturn {
  status: OllamaStatus | null;
  models: OllamaModel[];
  isLoading: boolean;
  error: string | null;
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  refresh: () => Promise<void>;
}

export function useOllama(initialProvider: LLMProvider = 'ollama'): UseOllamaReturn {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<LLMProvider>(initialProvider);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (provider === 'ollama') {
        // Get Ollama status
        const ollamaStatus = await getOllamaStatus();
        setStatus(ollamaStatus);

        // If available, get models
        if (ollamaStatus.available) {
          const modelList = await getOllamaModels('ollama');
          setModels(modelList);
        } else {
          setModels([]);
          setError('Ollama is not available on the server');
        }
      } else {
        // OpenRouter - just fetch models (availability is implied by API key being set)
        try {
          const modelList = await getOllamaModels('openrouter');
          setModels(modelList);
          setStatus({ available: true, baseUrl: 'https://openrouter.ai' });
        } catch {
          setModels([]);
          setError('OpenRouter is not available (check API key)');
          setStatus({ available: false, baseUrl: 'https://openrouter.ai' });
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to connect to provider');
      setStatus({ available: false, baseUrl: provider === 'ollama' ? 'http://localhost:11434' : 'https://openrouter.ai' });
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    models,
    isLoading,
    error,
    provider,
    setProvider,
    refresh,
  };
}

/**
 * Hook to check if bot features are available
 * Bot management is now available to all players as long as Ollama is running on the server
 */
export function useLocalhost(): { isLocalhost: boolean; isChecking: boolean } {
  // Bot features are now available to everyone, not just localhost
  // Keep the hook for backward compatibility but always return true
  return { isLocalhost: true, isChecking: false };
}
