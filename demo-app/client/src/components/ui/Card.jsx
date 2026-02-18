import React from 'react';

export default function Card({ header, children, className = '', state, padding = 'p-5' }) {
  const borderColor =
    state === 'ok' ? 't-ok-border' :
    state === 'error' ? 't-err-border' :
    't-border-s';

  return (
    <div className={`t-surface border rounded-xl t-shadow ${borderColor} ${className}`}>
      {header && (
        <div className="px-5 py-3 border-b t-border-s flex items-center gap-2">
          {header}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  );
}
