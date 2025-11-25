import React from 'react';
import { ChecklistItem, ChecklistStatus } from '../types';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface ChecklistProps {
  items: ChecklistItem[];
  checkedState: Record<string, ChecklistStatus>;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

const Checklist: React.FC<ChecklistProps> = ({ items, checkedState, onToggle, readOnly = false }) => {
  // Group by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const categories = Object.keys(groupedItems) as Array<ChecklistItem['category']>;

  const getStatusColor = (status: ChecklistStatus) => {
    switch (status) {
      case 'full': return 'bg-green-50 border-green-500';
      case 'partial': return 'bg-amber-50 border-amber-500';
      default: return 'bg-white border-transparent hover:bg-slate-50';
    }
  };

  const getIconColor = (status: ChecklistStatus) => {
    switch (status) {
      case 'full': return 'text-green-600';
      case 'partial': return 'text-amber-500';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-semibold text-slate-700">
            {category}
          </div>
          <div className="divide-y divide-slate-100">
            {groupedItems[category].map((item) => {
              const status = checkedState[item.id] || 'none';
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => !readOnly && onToggle(item.id)}
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-all duration-200 border-l-4 ${getStatusColor(status)} ${readOnly ? 'cursor-default' : ''}`}
                >
                  <div className={`mt-0.5 transition-colors ${getIconColor(status)}`}>
                    {status === 'full' && <CheckCircle2 size={24} fill="currentColor" className="text-white bg-green-600 rounded-full" />}
                    {status === 'partial' && <AlertCircle size={24} fill="currentColor" className="text-white bg-amber-500 rounded-full" />}
                    {status === 'none' && <Circle size={24} />}
                  </div>
                  
                  <div className="flex-1">
                    <span className={`text-sm md:text-base ${status !== 'none' ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                      {item.text}
                    </span>
                    
                    {/* Partial Credit Description */}
                    {status === 'partial' && item.partialCriteria && (
                      <div className="mt-1 text-xs text-amber-700 font-medium bg-amber-100/50 p-1.5 rounded inline-block">
                        Puntuación Parcial: {item.partialCriteria}
                      </div>
                    )}
                    
                    {/* Helper text if item allows partial but is currently unchecked */}
                    {status === 'none' && item.allowPartial && !readOnly && (
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                        Admite Parcial (Clickea 2 veces)
                      </p>
                    )}
                  </div>

                  {!readOnly && item.allowPartial && (
                    <div className="flex flex-col gap-1 text-[10px] font-mono text-slate-400 text-right">
                      {status === 'full' && <span>1.0</span>}
                      {status === 'partial' && <span>0.5</span>}
                      {status === 'none' && <span>0.0</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Checklist;