import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if credentials are provided
export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Database types
export interface DbUser {
  id: string;
  email: string;
  created_at: string;
  scan_count: number;
  is_premium: boolean;
}

export interface DbAnalysis {
  id: string;
  user_id: string;
  url: string;
  overall_score: number;
  clarity_score: number;
  specificity_score: number;
  proof_score: number;
  audience_score: number;
  blocker_count: number;
  strength_count: number;
  ai_understanding: any; // JSON object
  blockers: any; // JSON array
  strengths: any; // JSON array
  created_at: string;
}

// Helper functions
export async function getOrCreateUser(email: string): Promise<DbUser | null> {
  if (!supabase) return null;

  // First try to find existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    return existingUser as DbUser;
  }

  // Create new user if not found
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert([{ email: email.toLowerCase() }])
    .select()
    .single();

  if (createError) {
    console.error('Error creating user:', createError);
    return null;
  }

  return newUser as DbUser;
}

export async function incrementUserScanCount(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('increment_scan_count', { user_id: userId });
}

export async function saveAnalysis(
  userId: string,
  url: string,
  results: {
    overallScore: number;
    pillarScores: { clarity: number; specificity: number; proof: number; audience: number };
    blockers: any[];
    strengths: any[];
    aiUnderstanding: any;
  }
): Promise<DbAnalysis | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('analyses')
    .insert([{
      user_id: userId,
      url: url,
      overall_score: results.overallScore,
      clarity_score: results.pillarScores.clarity,
      specificity_score: results.pillarScores.specificity,
      proof_score: results.pillarScores.proof,
      audience_score: results.pillarScores.audience,
      blocker_count: results.blockers.length,
      strength_count: results.strengths.length,
      ai_understanding: results.aiUnderstanding,
      blockers: results.blockers,
      strengths: results.strengths,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error saving analysis:', error);
    return null;
  }

  return data as DbAnalysis;
}

export async function getUserAnalyses(userId: string): Promise<DbAnalysis[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching analyses:', error);
    return [];
  }

  return data as DbAnalysis[];
}

export async function getAnalysesByEmail(email: string): Promise<DbAnalysis[]> {
  if (!supabase) return [];

  // First get the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (userError || !user) {
    return [];
  }

  return getUserAnalyses(user.id);
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    return null;
  }

  return data as DbUser;
}

export async function canUserScan(email: string): Promise<{ allowed: boolean; reason?: string; user?: DbUser }> {
  if (!supabase) {
    // If Supabase not configured, allow all scans
    return { allowed: true };
  }

  const user = await getUserByEmail(email);

  if (!user) {
    // New user - they get their first scan free
    return { allowed: true };
  }

  if (user.is_premium) {
    // Premium users can scan unlimited
    return { allowed: true, user };
  }

  if (user.scan_count >= 1) {
    // Free users only get 1 scan
    return {
      allowed: false,
      reason: 'You have used your free scan. Upgrade to Premium for unlimited scans.',
      user
    };
  }

  return { allowed: true, user };
}
