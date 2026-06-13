import React, { useEffect, useState } from 'react';
import { getPendingRequests, updateRequestStatus } from '../services/requestService';
import { modifyTravelPlan } from '../services/gemini';
import { RefinementRequest, TravelPlan } from '../types';
import { useAdminAuth } from '../AdminAuthContext';
import { useAuth } from '../AuthContext';
import { CheckCircle, XCircle, Clock, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard({ 
  onBack, 
  onPlanUpdate 
}: { 
  onBack: () => void; 
  onPlanUpdate?: (plan: TravelPlan) => void 
}) {
  const adminAuth = useAdminAuth();
  const clientAuth = useAuth();
  const user = adminAuth?.user || clientAuth?.user;
  const [requests, setRequests] = useState<RefinementRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await getPendingRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: RefinementRequest) => {
    setProcessingId(request.id);
    try {
      const enrichedInstruction = request.type === 'adapt_day' && request.day
        ? `Modification for Day ${request.day}: ${request.instruction}`
        : request.instruction;

      // 1. Actually generate the modification using Gemini
      const updatedPlan = await modifyTravelPlan(request.current_plan, enrichedInstruction);
      
      // 2. Update status in Supabase
      await updateRequestStatus(request.id, 'approved', updatedPlan);
      
      // 3. If it's the current user's plan, update local state immediately
      if (onPlanUpdate && user && request.user_id === user.id) {
        onPlanUpdate(updatedPlan);
      }

      // 4. Remove from UI
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (err: any) {
      console.error('Approval failed:', err);
      let msg = 'Failed to process approval.';
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        msg = 'Elite AI Quota reached. Please wait a moment for the system to cool down.';
      } else if (err.message) {
        try {
          const parsed = JSON.parse(err.message);
          msg = parsed.error?.message || err.message;
        } catch {
          msg = err.message;
        }
      }
      alert(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await updateRequestStatus(requestId, 'rejected');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-primary p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex justify-between items-center bg-white/[0.03] p-8 rounded-[2rem] border border-white/5">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-accent/20 rounded-2xl">
              <ShieldCheck className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white display-font uppercase tracking-tighter">Admin Authority</h1>
              <p className="text-text-muted text-[10px] font-bold uppercase tracking-[0.4em]">Pending Refinement Matrix</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] uppercase font-black rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Command
          </button>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-32 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10">
            <Clock className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-white mb-2">No Operations Pending</h3>
            <p className="text-text-muted text-sm uppercase tracking-widest">All travel legacies are currently stable.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence>
              {requests.map(req => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card p-8 border-white/5 hover:border-accent/30 transition-all flex flex-col md:flex-row gap-8 items-start"
                >
                  <div className="bg-accent/10 p-4 rounded-xl shrink-0">
                    <Clock className="w-6 h-6 text-accent" />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest mb-1 block">
                          {req.type === 'adapt_day' ? `Day ${req.day} Adaptation` : 'Bespoke Refinement'}
                        </span>
                        <h4 className="text-lg font-bold text-white">{req.user_email}</h4>
                      </div>
                      <span className="text-[9px] text-text-muted uppercase font-bold">
                        {new Date(req.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white/5 p-5 rounded-2xl">
                      <p className="text-sm italic text-white/80 leading-relaxed font-serif">
                        "{req.instruction}"
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-bold text-text-muted">
                      <span>Destination: <b className="text-white">{req.current_plan.destination}</b></span>
                      <div className="w-1 h-1 bg-white/20 rounded-full" />
                      <span>Duration: <b className="text-white">{req.current_plan.itinerary.length} Days</b></span>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-3 w-full md:w-auto shrink-0">
                    <button
                      disabled={processingId !== null}
                      onClick={() => handleApprove(req)}
                      className="flex-1 md:w-40 flex items-center justify-center gap-2 px-6 py-4 bg-accent text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-accent/20"
                    >
                      {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      disabled={processingId !== null}
                      onClick={() => handleReject(req.id)}
                      className="flex-1 md:w-40 flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/10 text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500/10 active:scale-95 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
