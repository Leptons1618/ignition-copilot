import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Icon size={20} className="text-gray-400" />
      </div>
      {title && <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>}
      {description && <p className="text-xs text-gray-500 max-w-sm mb-3">{description}</p>}
      {action}
    </div>
  );
}
