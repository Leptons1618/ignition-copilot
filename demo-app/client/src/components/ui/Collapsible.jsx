import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Collapsible({ title, icon, children, defaultOpen = false, className = '', badge }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        {icon && <span className="text-gray-500">{icon}</span>}
        <span className="flex-1 text-left">{title}</span>
        {badge}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-gray-200">{children}</div>}
    </div>
  );
}
