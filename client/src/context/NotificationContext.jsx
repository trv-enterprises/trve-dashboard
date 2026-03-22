// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

import { createContext, useContext, useReducer, useCallback } from 'react';

const NotificationContext = createContext();

let nextId = 1;

function notificationReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [{ id: nextId++, timestamp: Date.now(), ...action.payload }, ...state];
    case 'REMOVE':
      return state.filter(n => n.id !== action.id);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

/**
 * NotificationProvider
 *
 * Provides an in-memory notification queue for the app.
 * Notifications are ephemeral — lost on page refresh.
 */
export function NotificationProvider({ children }) {
  const [notifications, dispatch] = useReducer(notificationReducer, []);

  const addNotification = useCallback((notification) => {
    // notification: { kind: 'success'|'error'|'info'|'warning', title, subtitle }
    dispatch({ type: 'ADD', payload: notification });
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
