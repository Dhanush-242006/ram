import React, { useState, useEffect } from 'react';
import { TravelPlan } from '../types';
import { 
  Package, Check, Plus, Trash2, RefreshCw, Sparkles, 
  CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PackingChecklistProps {
  plan: TravelPlan;
}

interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  essential: boolean;
  packed: boolean;
  custom?: boolean;
}

interface ChecklistCategory {
  categoryName: string;
  items: ChecklistItem[];
}

interface PackingChecklistData {
  weatherOverview: string;
  categories: ChecklistCategory[];
}

export default function PackingChecklist({ plan }: PackingChecklistProps) {
  const [checklist, setChecklist] = useState<PackingChecklistData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newItems, setNewItems] = useState<{ [categoryName: string]: string }>({});

  const tripId = `${plan.destination}_${plan.itinerary[0]?.date?.split(' (')[0] || 'date'}`;
  const localStorageKey = `ramsetuu_packing_${tripId}`;

  // Load checklist from localStorage or fetch from API
  useEffect(() => {
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        setChecklist(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved packing list, fetching fresh:', e);
        fetchChecklist();
      }
    } else {
      fetchChecklist();
    }
  }, [plan.destination, plan.itinerary]);

  const fetchChecklist = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = plan.itinerary[0]?.date?.split(' (')[0] || new Date().toISOString().split('T')[0];
      const response = await fetch('/api/packing-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: plan.destination,
          startDate: startDate,
          days: plan.itinerary.length,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate packing list');
      }

      const data = await response.json();
      
      // Enrich with unique IDs and initial packed status
      const enrichedCategories = data.categories.map((cat: any) => ({
        categoryName: cat.categoryName,
        items: cat.items.map((item: any, idx: number) => ({
          id: `${cat.categoryName}_${item.name.replace(/\s+/g, '_')}_${idx}`,
          name: item.name,
          description: item.description,
          essential: !!item.essential,
          packed: false
        }))
      }));

      const finalData: PackingChecklistData = {
        weatherOverview: data.weatherOverview,
        categories: enrichedCategories
      };

      setChecklist(finalData);
      localStorage.setItem(localStorageKey, JSON.stringify(finalData));
    } catch (err: any) {
      console.error(err);
      setError('Could not retrieve packing guide. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Save to localStorage whenever checklist state changes
  const updateLocalStorage = (updated: PackingChecklistData) => {
    setChecklist(updated);
    localStorage.setItem(localStorageKey, JSON.stringify(updated));
  };

  const handleToggleItem = (categoryName: string, itemId: string) => {
    if (!checklist) return;

    const updatedCategories = checklist.categories.map(cat => {
      if (cat.categoryName === categoryName) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              return { ...item, packed: !item.packed };
            }
            return item;
          })
        };
      }
      return cat;
    });

    updateLocalStorage({
      ...checklist,
      categories: updatedCategories
    });
  };

  const handleAddItem = (e: React.FormEvent, categoryName: string) => {
    e.preventDefault();
    const text = newItems[categoryName]?.trim();
    if (!text || !checklist) return;

    const newItem: ChecklistItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: text,
      description: 'Custom item added by you.',
      essential: false,
      packed: false,
      custom: true
    };

    const updatedCategories = checklist.categories.map(cat => {
      if (cat.categoryName === categoryName) {
        return {
          ...cat,
          items: [...cat.items, newItem]
        };
      }
      return cat;
    });

    updateLocalStorage({
      ...checklist,
      categories: updatedCategories
    });

    setNewItems(prev => ({ ...prev, [categoryName]: '' }));
  };

  const handleDeleteItem = (categoryName: string, itemId: string) => {
    if (!checklist) return;

    const updatedCategories = checklist.categories.map(cat => {
      if (cat.categoryName === categoryName) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    });

    updateLocalStorage({
      ...checklist,
      categories: updatedCategories
    });
  };

  const handleResetChecklist = () => {
    if (!checklist) return;
    if (window.confirm('Do you want to reset your checkmarks? This will uncheck all items.')) {
      const updatedCategories = checklist.categories.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, packed: false }))
      }));
      updateLocalStorage({
        ...checklist,
        categories: updatedCategories
      });
    }
  };

  const handleRegenerate = () => {
    if (window.confirm('Are you sure you want to regenerate the packing checklist? This will erase custom items and progress.')) {
      fetchChecklist();
    }
  };

  // Calculations for progress indicators
  const totalItems = checklist
    ? checklist.categories.reduce((acc, cat) => acc + cat.items.length, 0)
    : 0;
  const packedItems = checklist
    ? checklist.categories.reduce((acc, cat) => acc + cat.items.filter(i => i.packed).length, 0)
    : 0;
  const progressPercent = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-8 min-h-[400px]">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-2 border-white/5 border-t-accent rounded-full" 
          />
          <Package className="absolute inset-0 m-auto w-8 h-8 text-accent animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-light animate-bounce" />
            Analyzing Microclimate
          </h3>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.25em]">
            Curating your bespoke packing blueprint...
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="glass-card p-10 border-red-500/20 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Checklist Generation Blocked</h3>
        <p className="text-xs text-text-muted leading-relaxed mb-6">{error}</p>
        <button 
          onClick={fetchChecklist}
          className="btn-premium py-2.5 px-6 text-[10px] uppercase tracking-widest leading-none bg-accent text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  if (!checklist) return null;

  return (
    <div className="space-y-8">
      {/* Upper Panel: Weather Overview & Progress Track */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Weather overview */}
        <div className="lg:col-span-2 glass-card p-8 border-white/5 relative bg-gradient-to-br from-white/[0.02] to-transparent overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Sparkles className="w-20 h-20 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-4 bg-accent rounded-full" />
              <h4 className="text-[10px] font-black text-accent-light uppercase tracking-[0.3em]">Destination Climate Audit</h4>
            </div>
            <p className="text-[14px] text-text-main leading-relaxed font-light">
              {checklist.weatherOverview}
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-[9px] font-bold text-text-muted uppercase tracking-widest">
            <Info className="w-3.5 h-3.5 text-accent-light" />
            Recommended specifically for travel starting {plan.itinerary[0]?.date?.split(' (')[0]}.
          </div>
        </div>

        {/* Global Progress Track */}
        <div className="glass-card p-8 border-accent/20 bg-accent/5 ring-1 ring-accent/10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Packing Status</h4>
              <p className="text-3xl font-black text-text-main mt-1 display-font">
                {progressPercent}% <span className="text-xs font-bold text-accent-light">Ready</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center border border-accent/20">
              <Package className="w-5 h-5 text-accent-light" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-black text-text-muted uppercase tracking-widest">
              <span>{packedItems} / {totalItems} Packed</span>
              <span>{totalItems - packedItems} Remaining</span>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
            <button 
              onClick={handleResetChecklist}
              className="flex-1 py-2 text-[8px] font-black uppercase text-center tracking-widest border border-white/10 text-text-muted rounded-lg hover:text-white hover:border-white/20 transition-all cursor-pointer"
            >
              Reset Checked
            </button>
            <button 
              onClick={handleRegenerate}
              className="flex-1 py-2 text-[8px] font-black uppercase text-center tracking-widest border border-accent/30 text-accent-light rounded-lg hover:bg-accent/10 transition-all cursor-pointer"
            >
              Regenerate
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {checklist.categories.map((cat) => {
          const categoryName = cat.categoryName;
          const completedCount = cat.items.filter(i => i.packed).length;
          const isCategoryComplete = cat.items.length > 0 && completedCount === cat.items.length;

          return (
            <motion.div 
              key={categoryName}
              layout
              className={`glass-card p-6 border-white/5 flex flex-col justify-between transition-all duration-300 ${isCategoryComplete ? 'bg-accent/5 border-accent/20' : ''}`}
            >
              <div>
                {/* Category Header */}
                <div className="flex justify-between items-center mb-6">
                  <h5 className="font-black text-text-main tracking-widest uppercase text-[11px] font-mono flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCategoryComplete ? 'bg-accent-light' : 'bg-white/40'}`} />
                    {categoryName}
                  </h5>
                  <span className="text-[9px] font-black text-text-muted tracking-widest bg-white/5 py-1 px-2.5 rounded-full uppercase">
                    {completedCount} / {cat.items.length}
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2 mb-6">
                  <AnimatePresence initial={false}>
                    {cat.items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => handleToggleItem(categoryName, item.id)}
                        className={`group px-3.5 py-3 rounded-xl border flex items-start gap-3.5 cursor-pointer select-none transition-all duration-300 ${
                          item.packed
                            ? 'bg-accent/10 border-accent/30 opacity-70'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                        }`}
                      >
                        {/* Styled custom checkbox */}
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${
                          item.packed
                            ? 'bg-accent border-accent text-white scale-95 shadow-lg shadow-accent/20'
                            : 'border-white/20 group-hover:border-white/40'
                        }`}>
                          <AnimatePresence>
                            {item.packed && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[4px]" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Title and descriptions */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[12px] font-extrabold leading-tight text-text-main transition-all ${item.packed ? 'line-through opacity-40' : ''}`}>
                              {item.name}
                            </span>
                            {item.essential && (
                              <span className="text-[7px] font-black text-[#FFB020] border border-[#FFB020]/30 bg-[#FFB020]/10 px-1.5 py-0.5 rounded uppercase tracking-widest leading-none shrink-0">
                                Essential
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[9px] text-text-muted mt-1 leading-relaxed font-medium">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Custom item delete button */}
                        {item.custom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(categoryName, item.id);
                            }}
                            className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded-md text-white/20 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete custom item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {cat.items.length === 0 && (
                    <div className="text-center py-6 text-[10px] text-text-muted font-bold uppercase tracking-widest">
                      No items in this category
                    </div>
                  )}
                </div>
              </div>

              {/* Add Custom Item Interface */}
              <form 
                onSubmit={(e) => handleAddItem(e, categoryName)}
                className="mt-4 pt-4 border-t border-white/5 flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Need something else? Add it..."
                  value={newItems[categoryName] || ''}
                  onChange={(e) => setNewItems(prev => ({ ...prev, [categoryName]: e.target.value }))}
                  className="flex-1 bg-white/5 dark:bg-white/5 light:bg-slate-100 text-text-main placeholder-text-muted/50 font-bold border border-white/5 rounded-xl text-[10px] px-3.5 py-2.5 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={!newItems[categoryName]?.trim()}
                  className="bg-white/5 border border-white/5 hover:bg-accent hover:border-accent text-text-main hover:text-white p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/5 leading-none cursor-pointer"
                  title="Add custom packing item"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
