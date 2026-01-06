'use client';

import { useState, useEffect } from 'react';
import LandingScreen from '@/components/LandingScreen';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import DashboardScreen from '@/components/DashboardScreen';
import RewriteScreen from '@/components/RewriteScreen';
import PastScansScreen from '@/components/PastScansScreen';

export interface UserState {
  email: string;
  hasUsedFreeScan: boolean;
  isPro: boolean;
}

export interface AnalysisResult {
  success: boolean;
  url: string;
  analyzedAt: string;
  elapsedSeconds: number;
  pagesAnalyzed: number;
  scores: {
    total: number;
    pillars: {
      clarity: number;
      specificity: number;
      proof: number;
      audience: number;
    };
  };
  understanding: {
    oneLiner: string;
    category: string;
    audience: string;
    useCases: string[];
    confusions: string[];
    missingForConfidence: string[];
    confidence: {
      score: number;
      level: string;
      reason: string;
    };
  };
  blockers: Array<{
    code: string;
    title: string;
    description: string;
    pillar: string;
    severity: number;
    evidence: Array<{
      url: string;
      snippet: string;
      location: string;
    }>;
    fixStrategy: string;
  }>;
  strengths: Array<{
    code: string;
    title: string;
    description: string;
    pillar: string;
    impact: number;
    evidence: Array<{
      url: string;
      snippet: string;
      location: string;
    }>;
  }>;
}

export interface AnalysisStep {
  id: number;
  text: string;
  status: 'pending' | 'active' | 'done';
}

type Screen = 'landing' | 'analyzing' | 'dashboard' | 'rewrite' | 'pastScans';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [url, setUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedBlocker, setSelectedBlocker] = useState<AnalysisResult['blockers'][0] | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([
    { id: 1, text: 'Crawling pages', status: 'pending' },
    { id: 2, text: 'Extracting content', status: 'pending' },
    { id: 3, text: 'Building AI understanding', status: 'pending' },
    { id: 4, text: 'Identifying blockers', status: 'pending' },
    { id: 5, text: 'Calculating score', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (stepId: number, status: 'pending' | 'active' | 'done') => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const [email, setEmail] = useState('');

  const startAnalysis = async (inputUrl: string, userEmail?: string) => {
    setUrl(inputUrl);
    if (userEmail) setEmail(userEmail);
    setError(null);
    setCurrentScreen('analyzing');

    // Reset steps
    setSteps([
      { id: 1, text: 'Crawling pages', status: 'active' },
      { id: 2, text: 'Extracting content', status: 'pending' },
      { id: 3, text: 'Building AI understanding', status: 'pending' },
      { id: 4, text: 'Identifying blockers', status: 'pending' },
      { id: 5, text: 'Calculating score', status: 'pending' },
    ]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, email: userEmail }),
      });

      // Create a reader for the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let result: AnalysisResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'step') {
              // Update step status
              if (data.step > 1) {
                updateStep(data.step - 1, 'done');
              }
              updateStep(data.step, 'active');
            } else if (data.type === 'complete') {
              // Mark all steps as done
              setSteps(prev => prev.map(step => ({ ...step, status: 'done' as const })));
              result = data.result;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      if (result) {
        setAnalysisResult(result);
        setTimeout(() => setCurrentScreen('dashboard'), 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setTimeout(() => setCurrentScreen('landing'), 2000);
    }
  };

  const showRewrite = (blocker: AnalysisResult['blockers'][0]) => {
    setSelectedBlocker(blocker);
    setCurrentScreen('rewrite');
  };

  const showDashboard = () => {
    setCurrentScreen('dashboard');
  };

  const showLanding = () => {
    setCurrentScreen('landing');
    setAnalysisResult(null);
    setSelectedBlocker(null);
  };

  const showPastScans = (userEmail: string) => {
    setEmail(userEmail);
    setCurrentScreen('pastScans');
  };

  const viewPastAnalysis = async (analysisId: string) => {
    try {
      const response = await fetch(`/api/analyses/${analysisId}`);
      const data = await response.json();
      if (data && !data.error) {
        setAnalysisResult({
          success: true,
          url: data.url,
          analyzedAt: data.createdAt,
          elapsedSeconds: 0,
          pagesAnalyzed: 0,
          scores: {
            total: data.overallScore,
            pillars: data.pillarScores,
          },
          understanding: data.aiUnderstanding || {
            oneLiner: '',
            category: '',
            audience: '',
            useCases: [],
            confusions: [],
            missingForConfidence: [],
            confidence: { score: 0, level: 'Unknown', reason: '' },
          },
          blockers: data.blockers || [],
          strengths: data.strengths || [],
        });
        setUrl(data.url);
        setCurrentScreen('dashboard');
      }
    } catch (err) {
      console.error('Error loading analysis:', err);
    }
  };

  return (
    <main>
      {currentScreen === 'landing' && (
        <LandingScreen onAnalyze={startAnalysis} onViewPastScans={showPastScans} />
      )}
      {currentScreen === 'analyzing' && (
        <AnalyzingScreen url={url} steps={steps} error={error} />
      )}
      {currentScreen === 'dashboard' && analysisResult && (
        <DashboardScreen
          result={analysisResult}
          onRewrite={showRewrite}
          onRescan={() => startAnalysis(url)}
          onNewSite={showLanding}
        />
      )}
      {currentScreen === 'rewrite' && selectedBlocker && analysisResult && (
        <RewriteScreen
          blocker={selectedBlocker}
          siteName={new URL(analysisResult.url).hostname}
          siteInfo={{
            description: analysisResult.understanding.oneLiner,
            category: analysisResult.understanding.category,
            audience: analysisResult.understanding.audience,
          }}
          onBack={showDashboard}
        />
      )}
      {currentScreen === 'pastScans' && email && (
        <PastScansScreen
          email={email}
          onBack={showLanding}
          onViewAnalysis={viewPastAnalysis}
        />
      )}
    </main>
  );
}
