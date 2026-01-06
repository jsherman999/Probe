/**
 * Hook for interacting with Ollama status and models
 */

import { useState, useEffect, useCallback } from 'react';
import { getOllamaStatus, getOllamaModels, OllamaModel, OllamaStatus } from '../services/botApi';

interface UseOllamaReturn {
  status: OllamaStatus | null;
  models: OllamaModel[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOllama(): UseOllamaReturn {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get Ollama status
      const ollamaStatus = await getOllamaStatus();
      setStatus(ollamaStatus);

      // If available, get models
      if (ollamaStatus.available) {
        const modelList = await getOllamaModels();
        setModels(modelList);
      } else {
        setModels([]);
        setError('Ollama is not available on the server');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to connect to Ollama');
      setStatus({ available: false, baseUrl: 'http://localhost:11434' });
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    status,
    models,
    isLoading,
    error,
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
