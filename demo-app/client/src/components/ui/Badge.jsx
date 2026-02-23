import React from 'react';

const colors = {
  success: 't-ok-soft t-ok t-ok-border',
  warning: 't-warn-soft t-warn t-warn-border',
  error: 't-err-soft t-err t-err-border',
  info: 't-info-soft t-info t-info-border',
  neutral: 't-bg-alt t-text-2 t-border-s',
};

export default function Badge({ color = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${colors[color] || colors.neutral} ${className}`}>
      {children}
    </span>
  );
}
