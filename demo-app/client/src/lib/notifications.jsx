import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const STYLES = {
  success: 't-ok-soft t-ok t-ok-border',
  warning: 't-warn-soft t-warn t-warn-border',
  error: 't-err-soft t-err t-err-border',
  info: 't-info-soft t-info t-info-border',
};

function makeToast(level, message, title = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    title: String(title || ''),
    message: String(message || ''),
  };
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((level, message, title = '') => {
    const toast = makeToast(level, message, title);
    setToasts(prev => [toast, ...prev].slice(0, 6));
    setTimeout(() => dismiss(toast.id), 5000);
    return toast.id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message, title = '') => push('success', message, title),
    warning: (message, title = '') => push('warning', message, title),
    error: (message, title = '') => push('error', message, title),
    info: (message, title = '') => push('info', message, title),
    dismiss,
  }), [push, dismiss]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-24px))]">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.level] || Info;
          const style = STYLES[toast.level] || STYLES.info;
          return (
            <div key={toast.id} className={`border rounded-lg px-3 py-2 t-shadow-lg ${style}`}>
              <div className="flex items-start gap-2">
                <Icon size={16} className="shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {toast.title && <div className="text-xs font-semibold">{toast.title}</div>}
                  <div className="text-xs break-words">{toast.message}</div>
                </div>
                <button onClick={() => dismiss(toast.id)} className="cursor-pointer t-text-m hover:t-text" aria-label="Dismiss">
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

export default NotificationProvider;
