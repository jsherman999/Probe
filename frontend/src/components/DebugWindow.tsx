import { useEffect, useState, useRef, useCallback } from 'react';
import socketService from '../services/socket';

interface LogLine {
  line: string;
  timestamp: string;
}

interface DebugWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DebugWindow({ isOpen, onClose }: DebugWindowProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const MAX_LOGS = 500;

  const scrollToBottom = useCallback(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  useEffect(() => {
    if (!isOpen) return;

    const socket = socketService.getSocket();
    if (!socket) {
      setError('Socket not connected');
      return;
    }

    // Subscribe to debug logs
    socket.emit('subscribeDebugLogs', (response: { success: boolean; error?: string }) => {
      if (response.success) {
        setIsSubscribed(true);
        setError(null);
      } else {
        setError(response.error || 'Failed to subscribe to debug logs');
      }
    });

    // Listen for log lines
    const handleLogLine = (data: LogLine) => {
      setLogs(prev => {
        const newLogs = [...prev, data];
        // Keep only the last MAX_LOGS entries
        if (newLogs.length > MAX_LOGS) {
          return newLogs.slice(-MAX_LOGS);
        }
        return newLogs;
      });
    };

    socket.on('debugLogLine', handleLogLine);

    return () => {
      socket.off('debugLogLine', handleLogLine);
      socket.emit('unsubscribeDebugLogs', () => {});
      setIsSubscribed(false);
    };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user scrolled up more than 100px from bottom, disable auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = () => {
    const text = filteredLogs.map(l => `[${l.timestamp}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const filteredLogs = filter
    ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 w-full md:w-[600px] lg:w-[800px] h-[400px] bg-gray-900 border-t border-l border-gray-700 rounded-tl-lg shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 rounded-tl-lg">
        <div className="flex items-center gap-3">
          <span className="text-green-400 font-mono text-sm">
            {isSubscribed ? '● Connected' : '○ Disconnected'}
          </span>
          <span className="text-gray-400 text-sm font-mono">
            Backend Logs ({filteredLogs.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            title="Clear logs"
          >
            Clear
          </button>
          <button
            onClick={copyLogs}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            title="Copy logs"
          >
            Copy
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              autoScroll ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            title="Toggle auto-scroll"
          >
            Auto-scroll
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2"
            title="Close (Ctrl+Shift+D)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 bg-gray-850 border-b border-gray-700">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Logs */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs p-2 bg-gray-900"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            {isSubscribed ? 'Waiting for logs...' : 'Not connected to log stream'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={index}
              className={`py-0.5 px-2 hover:bg-gray-800 whitespace-pre-wrap break-all ${
                log.line.includes('❌') || log.line.toLowerCase().includes('error')
                  ? 'text-red-400'
                  : log.line.includes('⚠️') || log.line.toLowerCase().includes('warn')
                  ? 'text-yellow-400'
                  : log.line.includes('✅') || log.line.includes('✓')
                  ? 'text-green-400'
                  : log.line.includes('🤖')
                  ? 'text-purple-400'
                  : log.line.includes('⏱️') || log.line.includes('⏰')
                  ? 'text-blue-400'
                  : 'text-gray-300'
              }`}
            >
              <span className="text-gray-500 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.line}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
