import { supabase } from '../lib/supabase';
import { RefinementRequest, TravelPlan } from '../types';

export const ADMIN_EMAILS = ['dhanush.nagireddy@hrud.ai', 'nsprakash75@gmail.com']; // Add other admins here

export async function submitRefinementRequest(
  userId: string, 
  userEmail: string,
  type: 'adapt_day' | 'bespoke_refine', 
  instruction: string, 
  currentPlan: TravelPlan,
  day?: number
) {
  const { data, error } = await supabase
    .from('refinement_requests')
    .insert({
      user_id: userId,
      user_email: userEmail,
      type,
      instruction,
      current_plan: currentPlan,
      status: 'pending',
      day: day || null
    })
    .select()
    .single();

  if (error) throw error;
  return data as RefinementRequest;
}

export async function getPendingRequests() {
  const { data, error } = await supabase
    .from('refinement_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as RefinementRequest[];
}

export async function updateRequestStatus(
  requestId: string, 
  status: 'approved' | 'rejected', 
  resultPlan?: TravelPlan
) {
  const { data, error } = await supabase
    .from('refinement_requests')
    .update({ 
      status, 
      result_plan: resultPlan || null 
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data as RefinementRequest;
}

export async function getLatestUserPlanUpdate(userId: string) {
  const { data, error } = await supabase
    .from('refinement_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return null;
  return data?.[0] as RefinementRequest | null;
}
