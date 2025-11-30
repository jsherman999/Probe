import { useState, useCallback } from 'react';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, message, type };
    
    setNotifications(prev => [...prev, notification]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((message: string) => addNotification(message, 'success'), [addNotification]);
  const error = useCallback((message: string) => addNotification(message, 'error'), [addNotification]);
  const info = useCallback((message: string) => addNotification(message, 'info'), [addNotification]);
  const warning = useCallback((message: string) => addNotification(message, 'warning'), [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    info,
    warning,
  };
}
