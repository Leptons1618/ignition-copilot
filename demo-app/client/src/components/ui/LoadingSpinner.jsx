import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 16, className = '', label }) {
  return (
    <span className={`inline-flex items-center gap-2 text-gray-500 ${className}`}>
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}
