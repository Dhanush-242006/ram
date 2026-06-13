import React from 'react';
import { TravelPlan } from '../types';
import { 
  Plane, MapPin, Clock, Utensils, Car, Info, 
  Hotel, CreditCard, ChevronRight, AlertCircle,
  Coffee, ArrowRight, Building2, Globe2,
  Phone, CheckCircle2, Calendar, ExternalLink, ArrowLeft,
  Sparkles, RefreshCw, Wand2, Send, Download, Plus,
  Train, Bus, ShieldCheck, Loader2, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generatePDF } from '../lib/pdfGenerator';
import { useAuth } from '../AuthContext';
import { submitRefinementRequest } from '../services/requestService';
import PackingChecklist from './PackingChecklist';

interface ItineraryDisplayProps {
  plan: TravelPlan;
  planHistory?: TravelPlan[];
  onVersionSelect?: (index: number) => void;
  onBack: () => void;
  onModify: (instruction: string) => void;
}

const HOTEL_IMAGES = [
  'photo-1520250497591-112f2f40a3f4' // Infinity pool on cliffside
];

const TRAVEL_IMAGES = [
  'photo-1469854523086-cc02fe5d8800', // Scenic winding desert highway
  'photo-1507525428034-b723cf961d3e', // Golden beach sunset
  'photo-1476514525535-07fb3b4ae5f1', // Boat moving through misty mountain lake
  'photo-1501785888041-af3ef285b470', // Alpine peaks reflection
  'photo-1493976040374-85c8e12f0c0e', // Kyoto ancient pathway pagoda
  'photo-1513407030348-c983a97b98d8', // Neon-themed Tokyo alley
  'photo-1472214222541-d510753a4907', // Lush green scenic mountain valley
  'photo-1488646953014-85cb44e25828', // Passports and binoculars flatlay
  'photo-1527631746610-bca00a040d60', // Amalfi Coast seaside village
  'photo-1506012787146-f92b2d7d6d96', // Cappadocia hot air balloons at sunrise
  'photo-1533105079780-92b9be482077', // Greece island sunset outlook
  'photo-1502602898657-3e91760cbb34'  // Eiffel tower panoramic view
];

const ACTIVITY_IMAGES = [
  'photo-1539635278303-d4002c07eae3', // Travelers celebrating on mountains
  'photo-1528605248644-14dd04022da1', // Intimate garden dinner under bistro lights
  'photo-1516450360452-9312f5e86fc7', // Dynamic night music festival
  'photo-1454496522488-7a8e488e8606', // Alpine glacier climbing
  'photo-1519741497674-611481863552', // Wine pouring and tasting
  'photo-1511739001486-6bfe10ce785f', // Elegant historic monument exploration
  'photo-1504674900247-0877df9cc836', // Plated modern luxury cuisine
  'photo-1531058020387-3be344559767', // Strolling historic town streets
  'photo-1549488344-1f9b8d2bd1f3', // Swim and kayak under waterfalls
  'photo-1508193638397-1c4234db14d8', // Guided jungle canopy path trek
  'photo-1500530855697-b586d89ba3ee', // Picturesque coastal road overlook
  'photo-1555396273-367ea4eb4db5'  // Master chef culinary craftsmanship
];

const getSeededImage = (width: number, height: number, tags: string[], lockSeed: number) => {
  const isHotel = tags.some(t => typeof t === 'string' && t.toLowerCase().includes('hotel'));
  const isActivity = tags.some(t => typeof t === 'string' && (t.toLowerCase().includes('activity') || t.toLowerCase().includes('attraction') || t.toLowerCase().includes('restaurant')));
  
  let list = TRAVEL_IMAGES;
  if (isHotel) {
    list = HOTEL_IMAGES;
  } else if (isActivity) {
    list = ACTIVITY_IMAGES;
  }
  
  const index = Math.abs(lockSeed) % list.length;
  const photoId = list[index];
  
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&h=${height}&q=85`;
};

const isValidTransport = (transport?: any) => {
  if (!transport) return false;
  
  // Make sure keys exist, are non-empty strings, and are not placeholder values.
  const type = transport.type;
  const dep = transport.departureLocation;
  const arr = transport.arrivalLocation;
  
  const hasRealFields = 
    type && typeof type === 'string' && type.trim().length > 0 && type.toLowerCase() !== 'string' &&
    dep && typeof dep === 'string' && dep.trim().length > 0 && dep.toLowerCase() !== 'string' &&
    arr && typeof arr === 'string' && arr.trim().length > 0 && arr.toLowerCase() !== 'string';
  
  return !!hasRealFields;
};

const getTimeOfDayIcon = (time: string) => {
  switch (time) {
    case 'Morning': return <Coffee className="w-4 h-4 text-accent-light" />;
    case 'Afternoon': return <Utensils className="w-4 h-4 text-accent-light" />;
    case 'Evening': return <Utensils className="w-4 h-4 text-accent-light" />;
    case 'Night': return <Sparkles className="w-4 h-4 text-accent-light" />;
    default: return <Clock className="w-4 h-4 text-accent-light" />;
  }
};

export default function ItineraryDisplay({ plan, planHistory = [], onVersionSelect, onBack, onModify }: ItineraryDisplayProps) {
  const { user } = useAuth();
  const [activeDay, setActiveDay] = React.useState(1);
  const [selectedTransportIndex, setSelectedTransportIndex] = React.useState(0);
  const [modifyingId, setModifyingId] = React.useState<string | null>(null); // 'global', 'day', or 'activity-idx'
  const [modValue, setModValue] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const [isEditingDates, setIsEditingDates] = React.useState(false);
  const [newDate, setNewDate] = React.useState(plan.itinerary[0]?.date.split(' (')[0] || '');
  const [newDays, setNewDays] = React.useState(plan.itinerary.length);
  const [viewMode, setViewMode] = React.useState<'cards' | 'timeline' | 'packing'>('cards');

  const handleDateUpdate = async () => {
    setIsEditingDates(false);
    onModify(`Change the trip start date to ${newDate} and total duration to ${newDays} days. Please reschedule all activities and transit options to fit this new timeline while maintaining the logic of the itinerary.`);
  };

  const selectedTransport = plan.transportOptions[selectedTransportIndex] || plan.transportOptions[0];

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'Flight': return <Plane className="w-4 h-4" />;
      case 'Train': return <Train className="w-4 h-4" />;
      case 'Bus': return <Bus className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  const handleApplyMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modValue.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const type = (modifyingId === 'global' || modifyingId === 'add-transport' || modifyingId === 'add-hotel') 
        ? 'bespoke_refine' 
        : 'adapt_day';
      
      const day = type === 'adapt_day' ? activeDay : undefined;

      await submitRefinementRequest(
        user.id,
        user.email || 'Anonymous',
        type,
        modValue,
        plan,
        day
      );

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
      setModifyingId(null);
      setModValue('');
    } catch (err) {
      console.error('Failed to submit request:', err);
      alert('Failed to send request to admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-full bg-primary relative gap-0 overflow-hidden">
      {/* Background elements */}
      <div className="atmosphere" />
      <div className="noise-overlay" />

      {/* Date Edit Modal */}
      <AnimatePresence>
        {isEditingDates && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingDates(false)}
              className="absolute inset-0 bg-primary/90 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-sm p-10 relative z-10 border-accent/40 shadow-[0_0_50px_rgba(var(--accent-rgb),0.2)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Modify Timeline</h3>
                <button 
                  onClick={() => setIsEditingDates(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 text-white rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">New Start Date</label>
                  <input 
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="glass-input !bg-white/5 !text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 block">New Duration (Days)</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setNewDays(Math.max(1, newDays - 1))}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all font-black text-white"
                    >
                      -
                    </button>
                    <div className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center font-black text-white text-lg">
                      {newDays}
                    </div>
                    <button 
                      onClick={() => setNewDays(Math.min(30, newDays + 1))}
                      className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all font-black text-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleDateUpdate}
                  className="btn-premium w-full py-4 uppercase tracking-[0.2em] font-black mt-4"
                >
                  Regenerate Trip
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Sidebar */}
      <aside className="w-full md:w-[360px] bg-secondary/80 backdrop-blur-3xl border-r border-white/5 p-6 shrink-0 overflow-y-auto max-h-screen sticky top-0 custom-scrollbar">
        <div className="flex flex-col gap-4 mb-4 pt-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-black text-text-muted hover:text-white uppercase tracking-[0.2em] transition-colors group mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Back to Concierge
          </button>

          {/* Admin Refinement Request */}
          <button
            onClick={() => setModifyingId('global')}
            className="btn-premium py-3 text-[10px] uppercase tracking-widest"
          >
            <Wand2 className="w-4 h-4" />
            Request Refinement
          </button>

          <button
            onClick={() => setIsEditingDates(true)}
            className="flex items-center gap-2 px-4 py-3 bg-accent/20 text-accent-light text-[10px] uppercase tracking-widest font-black rounded-xl border border-accent/20 hover:bg-accent/30 transition-all"
          >
            <Calendar className="w-4 h-4" />
            Adjust Timeline
          </button>

          <button
            onClick={() => generatePDF(plan)}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 text-white text-[10px] uppercase tracking-widest font-black rounded-xl border border-white/5 hover:bg-white/10 transition-all"
          >
            <Download className="w-4 h-4" />
            Download Portfolio
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'packing' ? 'cards' : 'packing')}
            className={`flex items-center gap-2 px-4 py-3 text-[10px] uppercase tracking-widest font-black rounded-xl border transition-all ${
              viewMode === 'packing'
                ? 'bg-accent/30 text-accent-light border-accent/40 shadow-[0_0_20px_rgba(108,92,231,0.2)]'
                : 'bg-white/5 text-white border-white/5 hover:bg-white/10'
            }`}
          >
            <Package className="w-4 h-4" />
            {viewMode === 'packing' ? 'Show Itinerary' : 'Packing Checklist'}
          </button>
        </div>

        {/* Status Notification */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 p-4 bg-accent/20 border border-accent/30 rounded-2xl flex items-center gap-3"
            >
              <ShieldCheck className="w-5 h-5 text-accent-light shrink-0" />
              <div className="text-[10px] font-bold text-white uppercase tracking-widest">
                Request transmitted. Admin review pending.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Modification Input */}
        <AnimatePresence>
          {modifyingId === 'global' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-10 overflow-hidden"
            >
              <form onSubmit={handleApplyMod} className="glass-card !rounded-2xl p-6 border-accent/30 shadow-2xl shadow-accent/10">
                <label className="block text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-4">Refinement Request</label>
                <textarea
                  autoFocus
                  value={modValue}
                  onChange={(e) => setModValue(e.target.value)}
                  placeholder="e.g. Include more private gallery tours..."
                  className="w-full p-4 text-xs bg-white/5 border border-white/10 rounded-xl mb-4 focus:ring-1 focus:ring-accent outline-none text-white resize-none h-28"
                />
                <div className="flex gap-3">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 bg-accent text-white text-[10px] font-black py-3 rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Send to Admin'}
                  </button>
                  <button type="button" onClick={() => setModifyingId(null)} className="px-4 py-2.5 bg-white/5 text-text-muted text-[10px] font-black rounded-lg uppercase tracking-widest border border-white/5">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transport Selection */}
        <div className="mb-6">
          <div className="card-title-label">Elite Logistics</div>
        </div>
        <div className="space-y-2 mb-8">
          {plan.transportOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedTransportIndex(idx)}
              className={`w-full text-left px-4 py-4 rounded-xl border transition-all duration-500 overflow-hidden relative group hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(108,92,231,0.15)] ${
                selectedTransportIndex === idx 
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/20 shadow-[0_0_25px_rgba(108,92,231,0.2)]' 
                  : 'border-white/5 bg-white/[0.02] hover:border-accent/40'
              }`}
            >
              {selectedTransportIndex === idx && (
                <motion.div layoutId="transportGlow" className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none" />
              )}
              <div className="flex justify-between items-center mb-3 relative">
                <div className="flex items-center gap-2">
                  <span className="text-accent">{getTransportIcon(option.type)}</span>
                  <span className="text-[9px] font-black text-accent-light uppercase tracking-[0.2em]">{option.company}</span>
                </div>
                {selectedTransportIndex === idx && <CheckCircle2 className="w-3.5 h-3.5 text-accent animate-pulse" />}
              </div>
              <div className="flex justify-between items-center font-bold text-sm mb-2 text-white relative">
                <span>{option.departureLocation}</span>
                <div className="flex-1 border-t border-dashed border-white/10 mx-3 self-center" />
                <span>{option.arrivalLocation}</span>
              </div>
              <div className="text-[10px] text-text-muted flex justify-between relative font-medium group-hover:text-white/70 transition-colors">
                <span>{option.timings.split(' - ')[0]}</span>
                <div className="flex items-center gap-1">
                   <Clock className="w-2.5 h-2.5" />
                   {option.duration}
                </div>
                <span>{option.timings.split(' - ')[1]}</span>
              </div>
              
              {/* Inline Booking Link for non-selected or all if preferred */}
              {selectedTransportIndex === idx && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-white/5 relative z-10"
                >
                  <a 
                    href={option.bookingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-white text-primary text-[9px] font-black uppercase tracking-[0.2em] py-3 rounded-lg flex items-center justify-center gap-2 hover:brightness-90 transition-all"
                  >
                    Reserve Passage
                  </a>
                </motion.div>
              )}
            </button>
          ))}
        </div>

        {/* Add Transport Button */}
        <div className="mb-10">
          <button
            onClick={() => setModifyingId('add-transport')}
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-text-muted hover:text-accent hover:border-accent/40 transition-all uppercase tracking-widest bg-white/[0.01]"
          >
            <Plus className="w-3.5 h-3.5" />
            Append Logistics
          </button>
        </div>

        {/* Transport Modification Input */}
        <AnimatePresence>
          {modifyingId === 'add-transport' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <form onSubmit={handleApplyMod} className="glass-card !rounded-2xl p-5 border-accent/30">
                <label className="block text-[9px] font-black text-accent uppercase tracking-widest mb-3">Add Logistics</label>
                <input
                  autoFocus
                  value={modValue}
                  onChange={(e) => setModValue(e.target.value)}
                  placeholder="e.g. Add a private chauffeur option..."
                  className="w-full p-3 text-xs bg-white/5 border border-white/10 rounded-lg mb-3 outline-none text-white focus:ring-1 focus:ring-accent"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-accent text-white text-[9px] font-black py-2 rounded-lg uppercase tracking-widest">Add</button>
                  <button type="button" onClick={() => setModifyingId(null)} className="px-3 py-2 bg-white/5 text-text-muted text-[9px] font-black rounded-lg uppercase tracking-widest border border-white/5">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Removed redundant Logistics Summary Card */}

        {/* Hotel Card */}
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden hover:border-accent/20 hover:shadow-[0_0_25px_rgba(108,92,231,0.1)] transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Hotel className="w-12 h-12" />
          </div>
          <div className="card-title-label !mb-6">Curated Enclaves</div>
          <div className="space-y-10">
            {plan.hotels.map((hotel, idx) => (
              <div key={idx} className="group cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <a 
                    href={hotel.mapsLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[14px] font-bold text-white group-hover:text-accent-light transition-colors flex items-center gap-1.5"
                  >
                    {hotel.name}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-y-0.5" />
                  </a>
                  <span className="text-[10px] font-black text-accent-light bg-accent/20 px-2 py-0.5 rounded-md uppercase">
                    {hotel.category}
                  </span>
                </div>
                
                {hotel.description && (
                  <p className="text-[10px] text-text-muted mb-3 font-medium leading-relaxed italic border-l-2 border-accent/20 pl-3">
                    {hotel.description}
                  </p>
                )}

                <div className="h-24 w-full rounded-xl overflow-hidden mb-4 border border-white/5 grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700">
                  <img 
                    src={getSeededImage(600, 400, [hotel.name, plan.destination, 'hotel'], 100 + idx)}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms]"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fallbackIndex = Math.abs(100 + idx) % HOTEL_IMAGES.length;
                      (e.target as HTMLImageElement).src = `https://images.unsplash.com/${HOTEL_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=600&h=400&q=80`;
                    }}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-muted mb-4 font-medium">
                   <div className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-accent-light" />
                      {hotel.pricePerNight}
                   </div>
                   <div className="w-1 h-1 bg-white/20 rounded-full" />
                   <div>{hotel.distanceFromAttractions}</div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {hotel.phoneNumber && (
                    <a href={`tel:${hotel.phoneNumber}`} className="flex items-center gap-2 text-[9px] font-bold text-white/40 hover:text-accent-light transition-colors">
                      <Phone className="w-3 h-3" />
                      {hotel.phoneNumber}
                    </a>
                  )}
                  {hotel.website && (
                    <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[9px] font-bold text-white/40 hover:text-accent-light transition-colors truncate">
                      <Globe2 className="w-3 h-3" />
                      {hotel.website.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {hotel.amenities.slice(0, 4).map((amenity, i) => (
                    <span key={i} className="text-[8px] font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-tighter">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Add Hotel Button */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <button
              onClick={() => setModifyingId('add-hotel')}
              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-text-muted hover:text-accent hover:border-accent/40 transition-all uppercase tracking-widest bg-white/[0.01]"
            >
              <Plus className="w-3.5 h-3.5" />
              Expand Enclaves
            </button>
          </div>

          {/* Hotel Modification Input */}
          <AnimatePresence>
            {modifyingId === 'add-hotel' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                <form onSubmit={handleApplyMod} className="glass-card !rounded-2xl p-5 border-accent/30">
                  <label className="block text-[9px] font-black text-accent uppercase tracking-widest mb-3">Add Residence</label>
                  <input
                    autoFocus
                    value={modValue}
                    onChange={(e) => setModValue(e.target.value)}
                    placeholder="e.g. Include a luxury boutique hotel near the coast..."
                    className="w-full p-3 text-xs bg-white/5 border border-white/10 rounded-lg mb-3 outline-none text-white focus:ring-1 focus:ring-accent"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-accent text-white text-[9px] font-black py-2 rounded-lg uppercase tracking-widest">Add</button>
                    <button type="button" onClick={() => setModifyingId(null)} className="px-3 py-2 bg-white/5 text-text-muted text-[9px] font-black rounded-lg uppercase tracking-widest border border-white/5">Cancel</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex-1 bg-primary p-6 md:p-12 overflow-y-auto pt-8 custom-scrollbar relative z-10">
        {/* Mobile Header Correction - Reduced height since app header is sticky */}
        <div className="md:hidden fixed top-0 left-0 w-full z-[60] glass-card p-3 flex justify-between items-center bg-primary/80">
           <button onClick={onBack} className="text-white"><ArrowLeft /></button>
           <span className="text-[9px] font-black uppercase tracking-widest">Day {activeDay} Itinerary</span>
           <div className="w-6" />
        </div>

        {/* Day selection */}
        {viewMode !== 'packing' && (
          <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
            {plan.itinerary.map((day) => (
              <button
                key={day.day}
                onClick={() => setActiveDay(day.day)}
                className={`flow-step-themed min-w-[140px] !py-3 !px-5 !border-white/5 !bg-white/[0.02] hover:border-accent/20 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(108,92,231,0.15)] transition-all duration-500 ${activeDay === day.day ? '!border-accent !bg-accent/5 !ring-accent/10 shadow-[0_0_20px_rgba(108,92,231,0.2)]' : ''}`}
              >
                <span className={`block text-[9px] font-black mb-1.5 tracking-[0.2em] uppercase transition-colors ${activeDay === day.day ? 'text-accent-light' : 'text-text-muted group-hover:text-white/50'}`}>DAY {day.day}</span>
                <span className="block text-xs font-bold truncate text-white">
                  {day.activities[0]?.plan.split(' ').slice(0, 2).join(' ')}
                </span>
              </button>
            ))}
          </div>
        )}
        
        {/* Mobile Back Button (Visible only on small screens) */}
        <button
          onClick={onBack}
          className="md:hidden flex items-center gap-2 text-xs font-bold text-accent mb-6 bg-white px-4 py-2 rounded-lg border border-border shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Planner
        </button>

        {/* Day Detail */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeDay}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-12"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-10 gap-6">
              <div>
                <span className="text-[10px] font-black text-accent-light uppercase tracking-[0.4em] mb-4 block">
                  {viewMode === 'packing' ? plan.destination : (plan.itinerary.find(d => d.day === activeDay)?.date || `Day ${activeDay}`)}
                </span>
                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter display-font italic uppercase">
                  {viewMode === 'packing' ? 'Packing Checklist' : `Day ${activeDay}`}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* View Selector */}
                <div className="flex bg-white/5 border border-white/10 rounded-full p-1 gap-1 h-10 items-center">
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={`px-4 h-8 text-[9px] font-black uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-1.5 leading-none ${viewMode === 'cards' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-white'}`}
                  >
                    Card View
                  </button>
                  <button 
                    onClick={() => setViewMode('timeline')}
                    className={`px-4 h-8 text-[9px] font-black uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-1.5 leading-none ${viewMode === 'timeline' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-muted hover:text-white'}`}
                  >
                    Timeline View
                  </button>
                  <button 
                    onClick={() => setViewMode('packing')}
                    className={`px-4 h-8 text-[9px] font-black uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-1.5 leading-none ${viewMode === 'packing' ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-text-muted hover:text-white'}`}
                  >
                    Packing Checklist
                  </button>
                </div>

                {viewMode !== 'packing' && (
                  <>
                    <div className="text-[10px] font-black text-text-muted bg-white/5 border border-white/5 px-5 py-2.5 rounded-full uppercase tracking-widest leading-none h-10 flex items-center">
                      {plan.itinerary.find(d => d.day === activeDay)?.activities.length} Curated Engagements
                    </div>
                    <button
                      onClick={() => setIsEditingDates(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white text-[10px] font-black rounded-full border border-white/10 hover:bg-white/20 transition-all uppercase tracking-widest leading-none h-10"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Edit Dates
                    </button>
                    <button
                      onClick={() => setModifyingId('day')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-accent/10 text-accent-light text-[10px] font-black rounded-full border border-accent/20 hover:bg-accent/20 transition-all uppercase tracking-widest leading-none h-10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Adapt Day
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Intercity Transport Transition */}
            {viewMode !== 'packing' && isValidTransport(plan.itinerary.find(d => d.day === activeDay)?.intercityTransport) && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-accent/5 border border-accent/25 rounded-3xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group hover:border-accent/40 hover:shadow-[0_0_30px_rgba(108,92,231,0.15)] hover:-translate-y-0.5 transition-all duration-500"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/40 group-hover:scale-105 transition-transform">
                    <span className="text-white scale-150">
                      {getTransportIcon(plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.type)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-accent-light uppercase tracking-[0.3em] mb-1">Elite Transition</h4>
                    <p className="text-xl font-bold text-white uppercase tracking-tight">
                      {plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.departureLocation} 
                      <ChevronRight className="inline w-5 h-5 mx-2 text-accent" /> 
                      {plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.arrivalLocation}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col md:items-end relative z-10">
                  <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">
                    {plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.company} • {plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.timings}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-accent">
                    <Clock className="w-4 h-4" />
                    {plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.duration}
                  </div>
                </div>
                <a 
                  href={plan.itinerary.find(d => d.day === activeDay)!.intercityTransport!.bookingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-premium py-3 px-8 text-[9px] uppercase tracking-widest relative z-10"
                >
                  Secure Passage
                </a>
              </motion.div>
            )}

            <AnimatePresence>
              {modifyingId === 'day' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-12"
                >
                  <div className="glass-card !rounded-3xl p-8 border-accent/30 shadow-2xl shadow-accent/10">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-accent" />
                      Propose Day {activeDay} Strategy Refinement
                    </h4>
                    <form onSubmit={handleApplyMod} className="flex flex-col md:flex-row gap-4">
                      <input 
                        autoFocus
                        disabled={isSubmitting}
                        type="text"
                        className="flex-1 glass-input"
                        placeholder="e.g. Pivot to culinary exploration, or reduce physical activity..."
                        value={modValue}
                        onChange={(e) => setModValue(e.target.value)}
                      />
                      <div className="flex gap-3">
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="btn-premium px-8 py-3 text-[10px] uppercase tracking-widest disabled:opacity-50"
                        >
                          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Send to Admin'}
                        </button>
                        <button type="button" onClick={() => setModifyingId(null)} className="px-5 py-3 bg-white/5 text-text-muted text-[10px] font-black rounded-xl border border-white/10 uppercase tracking-widest">Cancel</button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {viewMode === 'packing' ? (
              <PackingChecklist plan={plan} />
            ) : viewMode === 'cards' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {plan.itinerary.find(d => d.day === activeDay)?.activities.map((activity, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-card overflow-hidden group border-white/5 hover:border-accent/30 hover:shadow-[0_0_35px_rgba(108,92,231,0.15)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col"
                  >
                    <div className="h-72 bg-secondary relative overflow-hidden">
                      <img 
                        src={getSeededImage(1200, 800, [activity.attractions[0]?.name || activity.time, plan.destination], (activeDay * 20) + idx)}
                        alt={activity.plan.split('.')[0]}
                        className="w-full h-full object-cover transition-all duration-[2000ms] group-hover:scale-110 saturate-[0.8] contrast-[1.1]"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const fallbackIndex = Math.abs((activeDay * 20) + idx) % ACTIVITY_IMAGES.length;
                          (e.target as HTMLImageElement).src = `https://images.unsplash.com/${ACTIVITY_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=1200&h=800&q=80`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-transparent opacity-60" />
                      <div className="absolute top-6 left-6">
                        <span className="px-4 py-2 bg-white/90 text-primary text-[10px] font-black rounded-lg uppercase tracking-[0.2em] shadow-2xl">
                          {activity.time}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-10 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-6 gap-4">
                        <h4 className="text-2xl font-black text-white leading-tight display-font italic uppercase tracking-tight">
                          {activity.plan.split('.')[0]}
                        </h4>
                        <button
                          onClick={() => setModifyingId(`activity-${idx}`)}
                          className="p-2.5 bg-white/5 text-text-muted hover:text-white border border-white/5 hover:border-accent/40 rounded-xl transition-all"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {modifyingId === `activity-${idx}` && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mb-6 overflow-hidden"
                          >
                            <form onSubmit={handleApplyMod} className="bg-accent/10 border border-accent/20 p-6 rounded-2xl space-y-4">
                              <p className="text-[10px] font-black text-accent-light uppercase tracking-widest">Submit Pivot Proposal</p>
                              <textarea
                                autoFocus
                                disabled={isSubmitting}
                                className="w-full text-xs p-4 rounded-xl border-white/10 bg-white/5 focus:ring-accent text-white min-h-[100px] outline-none"
                                placeholder="Describe your alternate preference..."
                                value={modValue}
                                onChange={(e) => setModValue(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button 
                                  type="submit" 
                                  disabled={isSubmitting}
                                  className="flex-1 bg-accent text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Send className="w-3 h-3" /> Transmit to Concierge</>}
                                </button>
                                <button type="button" onClick={() => setModifyingId(null)} className="px-4 py-2.5 bg-white/5 text-text-muted text-[10px] font-black rounded-lg border border-white/10 uppercase tracking-widest">Cancel</button>
                              </div>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <p className="text-[15px] text-text-muted leading-relaxed mb-10 flex-1 font-light group-hover:text-white/80 transition-colors">
                        {activity.plan.split('.').slice(1).join('.')}
                      </p>

                      <div className="space-y-6 pt-10 border-t border-white/5">
                        {/* Transport */}
                        <div className="transport-tag-themed uppercase tracking-widest">
                          <Car className="w-4 h-4" />
                          {activity.transport.type} • {activity.transport.details}
                        </div>

                        {/* Attractions with Images */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {activity.attractions.map((attr, i) => (
                            <a 
                              key={i}
                              href={attr.mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/attr flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 hover:border-accent/45 hover:shadow-[0_0_15px_rgba(108,92,231,0.15)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                            >
                              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                <img 
                                  src={getSeededImage(200, 200, [attr.name, plan.destination], (activeDay * 200) + (idx * 5) + i)}
                                  alt={attr.name}
                                  className="w-full h-full object-cover group-hover/attr:scale-110 transition-transform duration-700"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const seed = (activeDay * 200) + (idx * 5) + i;
                                    const fallbackIndex = Math.abs(seed) % ACTIVITY_IMAGES.length;
                                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/${ACTIVITY_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=200&h=200&q=80`;
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[10px] font-black text-white uppercase tracking-widest truncate mb-1">{attr.name}</p>
                                 <div className="flex items-center gap-1 text-[9px] font-bold text-accent-light uppercase tracking-tighter opacity-70">
                                   <MapPin className="w-3 h-3" />
                                   View Location
                                 </div>
                              </div>
                            </a>
                          ))}
                        </div>

                        {/* Reminder */}
                        <div className="reminder-box-themed !bg-white/5 !border-white/5 !text-white/60">
                          {activity.reminder}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-0 relative pl-4 md:pl-2">
                {plan.itinerary.find(d => d.day === activeDay)?.activities.map((activity, idx) => (
                  <div key={idx} className="relative pl-10 md:pl-16 pb-16 last:pb-4 group">
                    {/* Vertical Connector Segment */}
                    <div className="absolute left-[7px] top-[24px] bottom-0 w-[2px] bg-white/10 group-last:hidden" />
                    
                    {/* Bullet Connector */}
                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary border-2 border-accent flex items-center justify-center transition-all duration-300 group-hover:scale-125 group-hover:border-accent-light group-hover:shadow-[0_0_15px_rgba(108,92,231,0.8)] z-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:bg-accent-light" />
                    </div>

                    {/* Timeline Activity Box */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="glass-card hover:border-accent/40 hover:shadow-[0_0_35px_rgba(108,92,231,0.15)] transition-all duration-500 p-8 md:p-10 flex flex-col lg:flex-row gap-8 overflow-hidden w-full relative"
                    >
                      {/* Left Column: Plan Content */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          {/* Time Indicator */}
                          <div className="flex items-center gap-2.5 mb-4">
                            {getTimeOfDayIcon(activity.time)}
                            <span className="text-[10px] font-black text-accent-light uppercase tracking-[0.25em]">
                              {activity.time} Engagement
                            </span>
                          </div>

                          {/* Plan Title & Adapt Pivot Button */}
                          <div className="flex justify-between items-start gap-4 mb-6">
                            <h4 className="text-2xl md:text-3xl font-black text-white leading-tight display-font italic uppercase tracking-tight">
                              {activity.plan.split('.')[0]}
                            </h4>
                            <button
                              onClick={() => setModifyingId(`activity-${idx}`)}
                              className="p-2.5 bg-white/5 text-text-muted hover:text-white border border-white/5 hover:border-accent/40 rounded-xl transition-all"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Submit Pivot Proposal Inline UI */}
                          <AnimatePresence>
                            {modifyingId === `activity-${idx}` && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-6 overflow-hidden"
                              >
                                <form onSubmit={handleApplyMod} className="bg-accent/10 border border-accent/20 p-6 rounded-2xl space-y-4">
                                  <p className="text-[10px] font-black text-accent-light uppercase tracking-widest">Submit Pivot Proposal</p>
                                  <textarea
                                    autoFocus
                                    disabled={isSubmitting}
                                    className="w-full text-xs p-4 rounded-xl border-white/10 bg-white/5 focus:ring-accent text-white min-h-[100px] outline-none"
                                    placeholder="Describe your alternate preference..."
                                    value={modValue}
                                    onChange={(e) => setModValue(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <button 
                                      type="submit" 
                                      disabled={isSubmitting}
                                      className="flex-1 bg-accent text-white py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                      {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Send className="w-3 h-3" /> Transmit</>}
                                    </button>
                                    <button type="button" onClick={() => setModifyingId(null)} className="px-4 py-2.5 bg-white/5 text-text-muted text-[10px] font-black rounded-lg border border-white/10 uppercase tracking-widest">Cancel</button>
                                  </div>
                                </form>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <p className="text-[15px] text-text-muted leading-relaxed mb-8 font-light group-hover:text-white/80 transition-colors">
                            {activity.plan.split('.').slice(1).join('.')}
                          </p>
                        </div>

                        {/* Logistics & Reminder */}
                        <div className="space-y-4 pt-6 border-t border-white/5 mt-auto">
                          <div className="transport-tag-themed uppercase tracking-widest text-[9px]">
                            <Car className="w-4 h-4" />
                            {activity.transport.type} • {activity.transport.details}
                          </div>

                          <div className="reminder-box-themed !bg-white/5 !border-white/5 !text-white/60">
                            {activity.reminder}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Imagery & Maps Destinations */}
                      <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4">
                        {/* Interactive Atmosphere Seed Snapshot */}
                        <div className="h-44 rounded-2xl overflow-hidden relative border border-white/5 group-hover:border-accent/20 transition-all duration-500">
                          <img 
                            src={getSeededImage(600, 400, [activity.attractions[0]?.name || activity.time, plan.destination], (activeDay * 20) + idx)}
                            alt={activity.plan.split('.')[0]}
                            className="w-full h-full object-cover transition-all duration-[2000ms] group-hover:scale-105 saturate-[0.8] contrast-[1.1]"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fallbackIndex = Math.abs((activeDay * 20) + idx) % ACTIVITY_IMAGES.length;
                              (e.target as HTMLImageElement).src = `https://images.unsplash.com/${ACTIVITY_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=600&h=400&q=80`;
                            }}
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary/90 to-transparent pointer-events-none" />
                        </div>

                        {/* Attractions List */}
                        <div className="space-y-3.5">
                          {activity.attractions.map((attr, i) => (
                            <a 
                              key={i}
                              href={attr.mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/attr flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 hover:border-accent/45 hover:shadow-[0_0_15px_rgba(108,92,231,0.15)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                            >
                              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                                <img 
                                  src={getSeededImage(200, 200, [attr.name, plan.destination], (activeDay * 200) + (idx * 5) + i)}
                                  alt={attr.name}
                                  className="w-full h-full object-cover group-hover/attr:scale-110 transition-transform duration-700"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const seed = (activeDay * 200) + (idx * 5) + i;
                                    const fallbackIndex = Math.abs(seed) % ACTIVITY_IMAGES.length;
                                    (e.target as HTMLImageElement).src = `https://images.unsplash.com/${ACTIVITY_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=200&h=200&q=80`;
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[10px] font-black text-white uppercase tracking-widest truncate mb-1">{attr.name}</p>
                                 <div className="flex items-center gap-1 text-[8px] font-bold text-accent-light uppercase tracking-tighter opacity-70">
                                   <MapPin className="w-3 h-3" />
                                   View Location
                                 </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Gallery Section */}
            {viewMode !== 'packing' && (
              <div className="mt-32 pt-16 border-t border-white/5">
                <div className="mb-10">
                  <div className="card-title-label">Global Atmosphere • Day {activeDay} Highlights</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {plan.itinerary.find(d => d.day === activeDay)?.activities.flatMap(a => a.attractions).slice(0, 4).map((attr, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 1 }}
                      className="aspect-[3/4] overflow-hidden rounded-[2rem] shadow-2xl group relative border border-white/5"
                    >
                      <img 
                        src={getSeededImage(600, 800, [attr.name, plan.destination], (activeDay * 1000) + i)}
                        alt={attr.name}
                        className="w-full h-full object-cover group-hover:scale-110 grayscale-[0.2] transition-transform duration-[3000ms]"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const seed = (activeDay * 1000) + i;
                          const fallbackIndex = Math.abs(seed) % TRAVEL_IMAGES.length;
                          (e.target as HTMLImageElement).src = `https://images.unsplash.com/${TRAVEL_IMAGES[fallbackIndex]}?auto=format&fit=crop&w=600&h=800&q=80`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex items-end p-8">
                        <span className="text-xs font-black text-white uppercase tracking-[0.3em] font-serif italic">{attr.name}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Packing Anthology Section */}
            {viewMode !== 'packing' && plan.packingGuide && plan.packingGuide.length > 0 && (
              <div className="mt-32 pt-20 border-t border-white/5">
                <div className="flex flex-col items-center text-center mb-16">
                  <div className="w-20 h-20 bg-accent/20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-accent/20 border border-accent/30 transition-transform">
                    <Package className="w-10 h-10 text-accent-light" />
                  </div>
                  <h2 className="text-[10px] font-black text-accent-light uppercase tracking-[0.4em] mb-4">Expedition Essentials</h2>
                  <h3 className="text-4xl font-black text-white uppercase tracking-tight font-serif italic italic-shadow">
                    Packing Anthology
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
                  {plan.packingGuide.map((category, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-card p-10 relative group hover:border-accent/40 hover:shadow-[0_0_30px_rgba(108,92,231,0.15)] hover:-translate-y-1 transition-all duration-500"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Package className="w-16 h-16 text-white" />
                      </div>
                      <h4 className="text-xs font-black text-accent-light uppercase tracking-[0.2em] mb-8 border-b border-accent/20 pb-4">
                        {category.category}
                      </h4>
                      <ul className="space-y-4">
                        {category.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-4 text-[10px] text-text-main/80 font-bold uppercase tracking-widest leading-relaxed">
                            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                              <CheckCircle2 className="w-2.5 h-2.5 text-accent-light" />
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-20 pt-20 border-t border-white/5 flex flex-col md:flex-row justify-center items-center gap-10">
              <button
                onClick={onBack}
                className="w-full md:w-auto flex items-center justify-center gap-4 px-10 py-5 bg-white/5 border border-white/10 rounded-2xl text-white text-[12px] font-black uppercase tracking-widest hover:bg-white/10 transition-all group"
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-2" />
                Return to Concierge
              </button>

              <button
                onClick={() => generatePDF(plan)}
                className="btn-premium w-full md:w-auto px-12 py-5 text-[12px] uppercase tracking-widest font-black"
              >
                <Download className="w-5 h-5" />
                Export Luxury Anthology (PDF)
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

      </section>
    </div>
  );
}
