import React from 'react';

const colors = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
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
