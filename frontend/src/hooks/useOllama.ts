/**
 * Hook for interacting with LLM providers (Ollama, OpenRouter, and local LM Studio)
 *
 * Fetches models from every provider in parallel and exposes them as a single
 * `combinedModels` list, each tagged with the provider it came from. This lets
 * UIs (e.g. Bot Creator) offer models from all sources in one dropdown while
 * still knowing which backend to route each model through.
 */

import { useState, useEffect, useCallback } from 'react';
import { getOllamaStatus, getLmStudioStatus, getOllamaModels, OllamaModel, OllamaStatus, LLMProvider } from '../services/botApi';

/**
 * A model tagged with the provider that serves it, plus a human-friendly label.
 */
export interface CombinedModel extends OllamaModel {
  provider: LLMProvider;
  displayLabel: string;
}

interface UseOllamaReturn {
  status: OllamaStatus | null;
  models: OllamaModel[];
  combinedModels: CombinedModel[];
  isLoading: boolean;
  error: string | null;
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  refresh: () => Promise<void>;
}

const PROVIDERS: LLMProvider[] = ['lmstudio', 'ollama', 'openrouter'];

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  lmstudio: 'LM Studio',
  ollama: 'Ollama',
  openrouter: 'OpenRouter',
};

/**
 * Build a display label for a model, e.g. "gpt-oss-120b (LM Studio)".
 * LM Studio model ids often carry an org prefix ("openai/gpt-oss-120b") which
 * we strip for readability.
 */
function displayLabelFor(provider: LLMProvider, name: string): string {
  const base = provider === 'lmstudio' && name.includes('/') ? name.split('/').pop()! : name;
  return `${base} (${PROVIDER_LABELS[provider]})`;
}

export function useOllama(initialProvider: LLMProvider = 'ollama'): UseOllamaReturn {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [combinedModels, setCombinedModels] = useState<CombinedModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<LLMProvider>(initialProvider);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch models from every provider in parallel; failures are tolerated.
      const results = await Promise.all(
        PROVIDERS.map(async (p) => {
          try {
            const list = await getOllamaModels(p);
            return list.map((m) => ({ ...m, provider: p, displayLabel: displayLabelFor(p, m.name) }));
          } catch {
            return [] as CombinedModel[];
          }
        })
      );

      const combined = results.flat();
      setCombinedModels(combined);

      // Legacy single-provider view: models from the currently selected provider
      const selected = results[PROVIDERS.indexOf(provider)];
      setModels(selected);

      // Overall status: available if any provider answered. Prefer LM Studio
      // (the local default) for the reported base URL when it is up.
      let anyAvailable = false;
      if (combined.length > 0) {
        anyAvailable = true;
      } else {
        // No models anywhere - check statuses to produce a helpful message
        const [lmStatus, ollamaStatus] = await Promise.all([
          getLmStudioStatus().catch(() => null),
          getOllamaStatus().catch(() => null),
        ]);
        anyAvailable = Boolean(lmStatus?.available || ollamaStatus?.available);
      }

      if (anyAvailable) {
        setStatus({ available: true, baseUrl: 'local' });
      } else {
        setStatus({ available: false, baseUrl: 'http://localhost:1234' });
        setError('No LLM provider is available (start LM Studio or Ollama on the server)');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to connect to providers');
      setStatus({ available: false, baseUrl: 'http://localhost:1234' });
      setModels([]);
      setCombinedModels([]);
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
    combinedModels,
    isLoading,
    error,
    provider,
    setProvider,
    refresh,
  };
}

/**
 * Hook to check if bot features are available
 * Bot management is now available to all players as long as an LLM provider
 * (LM Studio, Ollama, or OpenRouter) is running on the server.
 */
export function useLocalhost(): { isLocalhost: boolean; isChecking: boolean } {
  // Bot features are now available to everyone, not just localhost
  // Keep the hook for backward compatibility but always return true
  return { isLocalhost: true, isChecking: false };
}
