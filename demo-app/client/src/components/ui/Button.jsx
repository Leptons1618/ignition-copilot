import React from 'react';

const base = 'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary: 't-accent-bg hover:opacity-90 text-white cursor-pointer',
  secondary: 't-surface hover:t-surface-h t-text cursor-pointer',
  ghost: 'bg-transparent hover:t-surface-h t-text-2 cursor-pointer',
  danger: 't-err-fill hover:opacity-90 text-white cursor-pointer',
  outline: 't-surface hover:t-surface-h border t-border-s t-text-2 cursor-pointer',
  success: 't-ok-fill hover:opacity-90 text-white cursor-pointer',
};

const sizes = {
  xs: 'px-2 py-1 text-xs rounded',
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
};

export default function Button({
  variant = 'primary',
  size = 'sm',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.sm} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
