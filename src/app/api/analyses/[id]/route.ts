import { NextRequest } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: 'Analysis ID is required' }, { status: 400 });
  }

  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      return Response.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch the specific analysis
    const { data: analysis, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !analysis) {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Return the full analysis data
    return Response.json({
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
      aiUnderstanding: analysis.ai_understanding,
      blockers: analysis.blockers,
      strengths: analysis.strengths,
      createdAt: analysis.created_at,
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return Response.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
