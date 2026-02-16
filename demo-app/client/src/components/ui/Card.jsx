import React from 'react';

export default function Card({ header, children, className = '', state, padding = 'p-5' }) {
  const borderColor =
    state === 'ok' ? 'border-green-200' :
    state === 'error' ? 'border-red-200' :
    'border-gray-200';

  return (
    <div className={`bg-white border rounded-xl shadow-sm ${borderColor} ${className}`}>
      {header && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          {header}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
  );
}
