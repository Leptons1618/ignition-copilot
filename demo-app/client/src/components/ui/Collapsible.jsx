import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Collapsible({ title, icon, children, defaultOpen = false, className = '', badge }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border t-border-s rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium t-text-2 t-bg-alt hover:t-surface-h transition-colors cursor-pointer"
      >
        {icon && <span className="t-text-m">{icon}</span>}
        <span className="flex-1 text-left">{title}</span>
        {badge}
        <ChevronDown size={14} className={`t-text-m transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t t-border-s">{children}</div>}
    </div>
  );
}
