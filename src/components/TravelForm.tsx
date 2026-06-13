import React, { useState } from 'react';
import { UserInputs } from '../types';
import { Plane, MapPin, Calendar, Wallet, Users, Info, Sparkles, Check, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface TravelFormProps {
  onSubmit: (inputs: UserInputs) => void;
  isLoading: boolean;
  initialInputs: UserInputs;
}

export default function TravelForm({ onSubmit, isLoading, initialInputs }: TravelFormProps) {
  const [inputs, setInputs] = useState<UserInputs>(initialInputs);
  const [valFrom, setValFrom] = useState<{ status: 'idle' | 'loading' | 'valid' | 'invalid'; error?: string; corrected?: string }>({ status: 'idle' });
  const [valTo, setValTo] = useState<{ status: 'idle' | 'loading' | 'valid' | 'invalid'; error?: string; corrected?: string }>({ status: 'idle' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isVerifyingOnSubmit, setIsVerifyingOnSubmit] = useState<boolean>(false);

  const isProbablyGibberish = (str: string): boolean => {
    const s = str.toLowerCase().trim();
    // Rule 0: sequential keyboard or alphabet runs
    const commonWalks = ["abcde", "abcdef", "asdf", "qwerty", "zxcvb", "lkjhgf", "dfgh", "ghjk", "qwer", "abcd", "xyz"];
    if (commonWalks.some(walk => s.includes(walk))) {
      return true;
    }
    // Rule 1: check if word contains repeating 3 identical characters (e.g., 'aaa')
    if (/(.)\1\1/.test(s)) {
      return true;
    }
    // Rule 2: check vowel usage in reasonably long words
    const words = s.split(/[\s,.-]+/);
    for (const w of words) {
      if (w.length > 3) {
        const hasVowel = /[aeiouy]/.test(w);
        if (!hasVowel) {
          return true;
        }
      }
    }
    // Rule 3: consecutive consonant runs that are extremely unnatural (e.g., "qwrtyp", "bcdfg", "sdfghj")
    if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(s)) {
      return true;
    }
    return false;
  };

  const verifySinglePlace = async (name: string): Promise<{ isValid: boolean; correctedName?: string; reason?: string }> => {
    if (!name || name.trim().length < 2) {
      return { isValid: false, reason: "Location name is too short." };
    }
    if (isProbablyGibberish(name)) {
      return {
        isValid: false,
        correctedName: name,
        reason: "This does not match a recognizable standard travel destination or landmark name."
      };
    }
    try {
      const res = await fetch('/api/validate-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeName: name })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error('Validation API error:', err);
    }
    const words = name.trim().split(/\s+/);
    const isValidHeuristic = words.every(w => /^[a-zA-Z\x7f-\xff.,'-]+$/.test(w.replace(/[0-9]/g, ''))) && !isProbablyGibberish(name);
    return {
      isValid: isValidHeuristic,
      correctedName: name,
      reason: isValidHeuristic ? "Local verification fallback." : "This does not match a recognizable standard travel destination or landmark name."
    };
  };

  const validatePlace = async (name: string, type: 'from' | 'to') => {
    if (!name || name.trim().length < 2) {
      if (type === 'from') setValFrom({ status: 'idle' });
      else setValTo({ status: 'idle' });
      return;
    }
    
    const setter = type === 'from' ? setValFrom : setValTo;
    setter({ status: 'loading' });
    
    const res = await verifySinglePlace(name);
    if (res.isValid) {
      setter({
        status: 'valid',
        corrected: res.correctedName && res.correctedName.toLowerCase() !== name.toLowerCase() ? res.correctedName : undefined,
        error: res.reason
      });
    } else {
      setter({
        status: 'invalid',
        error: res.reason || 'Unrecognized location name.'
      });
    }
  };

  const applyCorrection = (type: 'from' | 'to', value: string) => {
    setInputs(prev => ({
      ...prev,
      [type === 'from' ? 'fromLocation' : 'toLocation']: value
    }));
    setSubmitError(null);
    if (type === 'from') {
      setValFrom({ status: 'valid' });
    } else {
      setValTo({ status: 'valid' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    let currentValFrom = valFrom;
    let currentValTo = valTo;

    setIsVerifyingOnSubmit(true);

    if (currentValFrom.status === 'idle') {
      setValFrom({ status: 'loading' });
      const res = await verifySinglePlace(inputs.fromLocation);
      if (res.isValid) {
        currentValFrom = {
          status: 'valid',
          corrected: res.correctedName && res.correctedName.toLowerCase() !== inputs.fromLocation.toLowerCase() ? res.correctedName : undefined,
          error: res.reason
        };
      } else {
        currentValFrom = {
          status: 'invalid',
          error: res.reason || 'Unrecognized location name.'
        };
      }
      setValFrom(currentValFrom);
    }

    if (currentValTo.status === 'idle') {
      setValTo({ status: 'loading' });
      const res = await verifySinglePlace(inputs.toLocation);
      if (res.isValid) {
        currentValTo = {
          status: 'valid',
          corrected: res.correctedName && res.correctedName.toLowerCase() !== inputs.toLocation.toLowerCase() ? res.correctedName : undefined,
          error: res.reason
        };
      } else {
        currentValTo = {
          status: 'invalid',
          error: res.reason || 'Unrecognized location name.'
        };
      }
      setValTo(currentValTo);
    }

    setIsVerifyingOnSubmit(false);

    if (currentValFrom.status === 'loading' || currentValTo.status === 'loading') {
      setSubmitError("Still validating. Please wait a moment...");
      return;
    }

    if (currentValFrom.status === 'invalid') {
      setSubmitError(`Please verify the Departure Point: ${currentValFrom.error || 'Invalid location.'}`);
      return;
    }

    if (currentValTo.status === 'invalid') {
      setSubmitError(`Please verify the Destination: ${currentValTo.error || 'Invalid location.'}`);
      return;
    }

    if (currentValFrom.status === 'valid' && currentValTo.status === 'valid') {
      onSubmit(inputs);
    } else {
      setSubmitError("Both Departure Point and Destination must be fully verified and valid to proceed.");
    }
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={handleSubmit}
      className="glass-card p-8 md:p-16 max-w-5xl mx-auto space-y-12"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* From Location */}
        <div className="space-y-3">
          <label className="flex items-center justify-between text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            <span>Departure Point</span>
            {valFrom.status === 'valid' && (
              <span className="text-[9px] text-emerald-400 font-bold normal-case tracking-normal">Location Verified</span>
            )}
            {valFrom.status === 'invalid' && (
              <span className="text-[9px] text-red-400 font-bold normal-case tracking-normal">Check Spelling</span>
            )}
          </label>
          <div className="relative group">
            <Plane className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <input
              required
              type="text"
              placeholder="e.g. Mumbai, India"
              className={`glass-input pl-14 pr-12 transition-all duration-300 ${
                valFrom.status === 'invalid' ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10' :
                valFrom.status === 'valid' ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/10' : ''
              }`}
              value={inputs.fromLocation}
              onChange={(e) => {
                setInputs({ ...inputs, fromLocation: e.target.value });
                if (valFrom.status !== 'idle') setValFrom({ status: 'idle' });
                setSubmitError(null);
              }}
              onBlur={() => validatePlace(inputs.fromLocation, 'from')}
            />
            {valFrom.status === 'loading' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
            )}
            {valFrom.status === 'valid' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </div>
            )}
            {valFrom.status === 'invalid' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center text-red-400" title={valFrom.error}>
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
          </div>
          {valFrom.status === 'valid' && valFrom.corrected && (
            <div className="text-[10px] font-bold text-accent-light uppercase tracking-wider ml-1 mt-1 bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg inline-block">
              Suggest: <button
                type="button"
                className="text-white hover:text-accent-light underline cursor-pointer font-extrabold"
                onClick={() => applyCorrection('from', valFrom.corrected!)}
              >
                {valFrom.corrected}
              </button>
            </div>
          )}
          {valFrom.status === 'invalid' && (
            <div className="text-[10px] font-bold text-red-400/90 uppercase tracking-wide ml-1 mt-1">
              {valFrom.error || "Unrecognized location name. Please verify spelling."}
            </div>
          )}
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <label className="flex items-center justify-between text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            <span>Destination</span>
            {valTo.status === 'valid' && (
              <span className="text-[9px] text-emerald-400 font-bold normal-case tracking-normal">Location Verified</span>
            )}
            {valTo.status === 'invalid' && (
              <span className="text-[9px] text-red-400 font-bold normal-case tracking-normal">Check Spelling</span>
            )}
          </label>
          <div className="relative group">
            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <input
              required
              type="text"
              placeholder="e.g. London, Paris, Rome"
              className={`glass-input pl-14 pr-12 transition-all duration-300 ${
                valTo.status === 'invalid' ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/10' :
                valTo.status === 'valid' ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/10' : ''
              }`}
              value={inputs.toLocation}
              onChange={(e) => {
                setInputs({ ...inputs, toLocation: e.target.value });
                if (valTo.status !== 'idle') setValTo({ status: 'idle' });
                setSubmitError(null);
              }}
              onBlur={() => validatePlace(inputs.toLocation, 'to')}
            />
            {valTo.status === 'loading' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
            )}
            {valTo.status === 'valid' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </div>
            )}
            {valTo.status === 'invalid' && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center text-red-400" title={valTo.error}>
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
          </div>
          {valTo.status === 'valid' && valTo.corrected && (
            <div className="text-[10px] font-bold text-accent-light uppercase tracking-wider ml-1 mt-1 bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg inline-block">
              Suggest: <button
                type="button"
                className="text-white hover:text-accent-light underline cursor-pointer font-extrabold"
                onClick={() => applyCorrection('to', valTo.corrected!)}
              >
                {valTo.corrected}
              </button>
            </div>
          )}
          {valTo.status === 'invalid' && (
            <div className="text-[10px] font-bold text-red-400/90 uppercase tracking-wide ml-1 mt-1">
              {valTo.error || "Unrecognized location name. Please verify spelling."}
            </div>
          )}
        </div>

        {/* Start Date */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            Travel Window
          </label>
          <div className="relative group">
            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <input
              required
              type="date"
              className="glass-input pl-14 [color-scheme:dark]"
              value={inputs.startDate}
              onChange={(e) => setInputs({ ...inputs, startDate: e.target.value })}
            />
          </div>
        </div>

        {/* Days */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            Duration
          </label>
          <div className="relative group">
            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <input
              required
              type="number"
              min="1"
              max="14"
              className="glass-input pl-14"
              value={isNaN(inputs.days) ? '' : inputs.days}
              onChange={(e) => setInputs({ ...inputs, days: parseInt(e.target.value) })}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted uppercase">Days</span>
          </div>
        </div>

        {/* Budget */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            Estimated Budget (₹)
          </label>
          <div className="relative group">
            <Wallet className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <input
              required
              type="text"
              placeholder="e.g. 150000"
              className="glass-input pl-14"
              value={inputs.budget}
              onChange={(e) => setInputs({ ...inputs, budget: e.target.value })}
            />
          </div>
        </div>

        {/* Service Level */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            Service Level
          </label>
          <div className="relative group">
            <Info className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <select
              className="glass-input pl-14 appearance-none cursor-pointer"
              value={inputs.budgetCategory}
              onChange={(e) => setInputs({ ...inputs, budgetCategory: e.target.value as any })}
            >
              <option value="Low" className="bg-secondary">Economy / Essential</option>
              <option value="Medium" className="bg-secondary">Standard / Signature</option>
              <option value="Luxury" className="bg-secondary">Premium / Elite</option>
            </select>
          </div>
        </div>
      </div>

      {/* Special Interests */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
          Bespoke Requirements & Interests
        </label>
        <div className="relative group">
          <Sparkles className="absolute left-5 top-6 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
          <textarea
            placeholder="e.g. Michelin stargazing, private yacht tours, ancient temple photography..."
            className="glass-input pl-14 h-32 resize-none py-5 leading-relaxed"
            value={inputs.locations}
            onChange={(e) => setInputs({ ...inputs, locations: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Travel Type */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">
            Travel Party
          </label>
          <div className="relative group">
            <Users className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent transition-colors group-focus-within:text-accent-light" />
            <select
              className="glass-input pl-14 appearance-none cursor-pointer"
              value={inputs.travelType}
              onChange={(e) => setInputs({ ...inputs, travelType: e.target.value as any })}
            >
              <option value="Solo" className="bg-secondary">Solo Traveler</option>
              <option value="Couple" className="bg-secondary">Couple</option>
              <option value="Family" className="bg-secondary">Family</option>
              <option value="Group" className="bg-secondary">Group</option>
            </select>
          </div>
        </div>

        {/* Concierge Support */}
        <div className="flex items-center h-full pt-8">
          <label className="flex items-center gap-4 group cursor-pointer w-full p-4 glass-card border-none hover:bg-white/[0.05] transition-colors">
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={inputs.travelAgentAssistance}
                onChange={(e) => setInputs({ ...inputs, travelAgentAssistance: e.target.checked })}
              />
              <div className="w-6 h-6 rounded-lg border-2 border-white/10 peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Elite Concierge</span>
              <span className="text-[9px] text-text-muted">Include professional human verification</span>
            </div>
          </label>
        </div>
      </div>

      {submitError && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-red-500/15 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4 text-red-200"
        >
          <AlertCircle className="w-5.5 h-5.5 shrink-0 text-red-400" />
          <div className="space-y-1">
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Verification Blocked</h5>
            <p className="text-[11px] font-bold leading-normal">{submitError}</p>
          </div>
        </motion.div>
      )}

      <motion.button
        whileHover={{ translateY: -4 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading || isVerifyingOnSubmit}
        type="submit"
        className="btn-premium w-full text-[13px] uppercase tracking-[0.2em] font-black py-6 shadow-2xl shadow-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading || isVerifyingOnSubmit ? (
          <div className="flex items-center justify-center gap-3 animate-pulse">
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
               className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" 
            />
            <span>{isVerifyingOnSubmit ? "Verifying Route Connection..." : "Crafting Legacy Itinerary..."}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5" />
            <span>Generate Master Plan</span>
          </div>
        )}
      </motion.button>
    </motion.form>
  );
}
