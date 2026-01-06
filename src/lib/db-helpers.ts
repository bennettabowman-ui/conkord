// Database helper functions for saving analysis results
// This is a wrapper to avoid import issues in the analyze route

import { getOrCreateUser, saveAnalysis, incrementUserScanCount, canUserScan } from './supabase';

export async function saveAnalysisToDb(
  email: string,
  url: string,
  results: {
    overallScore: number;
    pillarScores: { clarity: number; specificity: number; proof: number; audience: number };
    blockers: any[];
    strengths: any[];
    aiUnderstanding: any;
  }
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('Supabase not configured, skipping database save');
      return { success: true }; // Gracefully skip if not configured
    }

    // Get or create user
    const user = await getOrCreateUser(email);
    if (!user) {
      return { success: false, error: 'Failed to create user' };
    }

    // Save the analysis
    const analysis = await saveAnalysis(user.id, url, results);
    if (!analysis) {
      return { success: false, error: 'Failed to save analysis' };
    }

    // Increment user's scan count
    await incrementUserScanCount(user.id);

    return { success: true, analysisId: analysis.id };
  } catch (error) {
    console.error('Error saving to database:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function checkUserCanScan(email: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { allowed: true }; // Allow if not configured
    }

    return await canUserScan(email);
  } catch (error) {
    console.error('Error checking scan permission:', error);
    return { allowed: true }; // Default to allowing on error
  }
}
