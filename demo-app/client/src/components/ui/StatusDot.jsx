import React from 'react';

const colors = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
  info: 'bg-[var(--color-info)]',
  neutral: 'bg-[var(--color-text-muted)]',
};

export default function StatusDot({ color = 'neutral', pulse = false, size = 'w-2 h-2' }) {
  return (
    <span className="relative inline-flex">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${colors[color] || colors.neutral}`} />
      )}
      <span className={`relative inline-flex rounded-full ${size} ${colors[color] || colors.neutral}`} />
    </span>
  );
}
