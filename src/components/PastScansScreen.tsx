'use client';

import { useState, useEffect } from 'react';
import styles from './PastScansScreen.module.css';

interface PastAnalysis {
  id: string;
  url: string;
  overallScore: number;
  pillarScores: {
    clarity: number;
    specificity: number;
    proof: number;
    audience: number;
  };
  blockerCount: number;
  strengthCount: number;
  createdAt: string;
}

interface UserInfo {
  email: string;
  scanCount: number;
  isPremium: boolean;
  createdAt: string;
}

interface PastScansScreenProps {
  email: string;
  onBack: () => void;
  onViewAnalysis: (analysisId: string) => void;
}

export default function PastScansScreen({ email, onBack, onViewAnalysis }: PastScansScreenProps) {
  const [analyses, setAnalyses] = useState<PastAnalysis[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        const response = await fetch(`/api/analyses?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setAnalyses(data.analyses || []);
          setUser(data.user || null);
        }
      } catch (err) {
        setError('Failed to load past scans');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyses();
  }, [email]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className={styles.screen}>
      <div className={styles.bg}></div>
      <div className={styles.grid}></div>

      <div className={styles.content}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>

        <h1 className={styles.title}>Your Past Scans</h1>

        {user && (
          <div className={styles.userInfo}>
            <span>{user.email}</span>
            <span className={styles.badge}>
              {user.isPremium ? 'Premium' : `${user.scanCount} scan${user.scanCount !== 1 ? 's' : ''} used`}
            </span>
          </div>
        )}

        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading your scans...</p>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && analyses.length === 0 && (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No scans yet</p>
            <p className={styles.emptyHint}>Run your first analysis to see results here</p>
          </div>
        )}

        {!isLoading && analyses.length > 0 && (
          <div className={styles.scanList}>
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className={styles.scanCard}
                onClick={() => onViewAnalysis(analysis.id)}
              >
                <div className={styles.scanHeader}>
                  <div className={styles.scanUrl}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    <span>{new URL(analysis.url).hostname}</span>
                  </div>
                  <div
                    className={styles.score}
                    style={{ color: getScoreColor(analysis.overallScore) }}
                  >
                    {analysis.overallScore}
                  </div>
                </div>

                <div className={styles.scanMeta}>
                  <span className={styles.date}>{formatDate(analysis.createdAt)}</span>
                  <span className={styles.stats}>
                    {analysis.blockerCount} blocker{analysis.blockerCount !== 1 ? 's' : ''} · {analysis.strengthCount} strength{analysis.strengthCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className={styles.pillars}>
                  <div className={styles.pillar}>
                    <span className={styles.pillarLabel}>Clarity</span>
                    <div className={styles.pillarBar}>
                      <div
                        className={styles.pillarFill}
                        style={{
                          width: `${analysis.pillarScores.clarity}%`,
                          backgroundColor: getScoreColor(analysis.pillarScores.clarity),
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className={styles.pillar}>
                    <span className={styles.pillarLabel}>Specificity</span>
                    <div className={styles.pillarBar}>
                      <div
                        className={styles.pillarFill}
                        style={{
                          width: `${analysis.pillarScores.specificity}%`,
                          backgroundColor: getScoreColor(analysis.pillarScores.specificity),
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className={styles.pillar}>
                    <span className={styles.pillarLabel}>Proof</span>
                    <div className={styles.pillarBar}>
                      <div
                        className={styles.pillarFill}
                        style={{
                          width: `${analysis.pillarScores.proof}%`,
                          backgroundColor: getScoreColor(analysis.pillarScores.proof),
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className={styles.pillar}>
                    <span className={styles.pillarLabel}>Audience</span>
                    <div className={styles.pillarBar}>
                      <div
                        className={styles.pillarFill}
                        style={{
                          width: `${analysis.pillarScores.audience}%`,
                          backgroundColor: getScoreColor(analysis.pillarScores.audience),
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
