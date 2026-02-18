import React from 'react';

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`t-field-bg border t-field-border rounded-lg px-3 py-2 text-sm t-field-fg placeholder:t-text-m focus:outline-none focus:t-accent-border focus:ring-1 focus:ring-[var(--color-accent)] transition-colors ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`t-field-bg border t-field-border rounded-lg px-3 py-2 text-sm t-field-fg focus:outline-none focus:t-accent-border focus:ring-1 focus:ring-[var(--color-accent)] transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`t-field-bg border t-field-border rounded-lg px-3 py-2 text-sm t-field-fg placeholder:t-text-m focus:outline-none focus:t-accent-border focus:ring-1 focus:ring-[var(--color-accent)] transition-colors ${className}`}
      {...props}
    />
  );
}
