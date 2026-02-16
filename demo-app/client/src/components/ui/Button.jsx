import React from 'react';

const base = 'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none';

const variants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-800 hover:bg-gray-900 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  outline: 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-700',
  success: 'bg-green-600 hover:bg-green-700 text-white',
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
