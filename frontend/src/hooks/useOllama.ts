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
        setError('Ollama is not available. Make sure it\'s running on localhost:11434');
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
 * Hook to check if the current connection is from localhost
 * This is determined by checking if the API is accessible
 * (bot endpoints are localhost-only, so if they work, we're on localhost)
 */
export function useLocalhost(): { isLocalhost: boolean; isChecking: boolean } {
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkLocalhost = async () => {
      try {
        // Try to access a bot endpoint - if it works, we're on localhost
        await getOllamaStatus();
        setIsLocalhost(true);
      } catch (err: any) {
        // If we get a 403, we're not on localhost
        // If we get a network error, we might still be on localhost but Ollama is down
        if (err.response?.status === 403) {
          setIsLocalhost(false);
        } else {
          // Assume localhost if we can reach the server at all
          setIsLocalhost(true);
        }
      } finally {
        setIsChecking(false);
      }
    };

    checkLocalhost();
  }, []);

  return { isLocalhost, isChecking };
}
