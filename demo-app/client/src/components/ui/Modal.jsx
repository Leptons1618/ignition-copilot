import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open = true, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className={`t-surface rounded-xl t-shadow-lg border t-border-s ${maxWidth} w-full mx-4 max-h-[85vh] flex flex-col`}>
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b t-border-s shrink-0">
            <h3 className="text-sm font-semibold t-text">{title}</h3>
            <button onClick={onClose} className="t-text-m hover:t-text-2 transition-colors cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
