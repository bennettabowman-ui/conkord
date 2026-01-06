import { NextRequest } from 'next/server';
import { getAnalysesByEmail, getUserByEmail, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return Response.json({ analyses: [], message: 'Database not configured' });
    }

    // Get user info
    const user = await getUserByEmail(email);
    if (!user) {
      return Response.json({ analyses: [], user: null });
    }

    // Get all analyses for this user
    const analyses = await getAnalysesByEmail(email);

    // Transform for frontend consumption
    const formattedAnalyses = analyses.map(analysis => ({
      id: analysis.id,
      url: analysis.url,
      overallScore: analysis.overall_score,
      pillarScores: {
        clarity: analysis.clarity_score,
        specificity: analysis.specificity_score,
        proof: analysis.proof_score,
        audience: analysis.audience_score,
      },
      blockerCount: analysis.blocker_count,
      strengthCount: analysis.strength_count,
      createdAt: analysis.created_at,
    }));

    return Response.json({
      analyses: formattedAnalyses,
      user: {
        email: user.email,
        scanCount: user.scan_count,
        isPremium: user.is_premium,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching analyses:', error);
    return Response.json(
      { error: 'Failed to fetch analyses' },
      { status: 500 }
    );
  }
}
