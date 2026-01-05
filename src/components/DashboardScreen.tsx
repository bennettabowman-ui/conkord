'use client';

import { useState } from 'react';
import styles from './DashboardScreen.module.css';
import { AnalysisResult } from '@/app/page';

interface DashboardScreenProps {
  result: AnalysisResult;
  onRewrite: (blocker: AnalysisResult['blockers'][0]) => void;
  onRescan: () => void;
  onNewSite: () => void;
}

export default function DashboardScreen({ result, onRewrite, onRescan, onNewSite }: DashboardScreenProps) {
  const [expandedBlocker, setExpandedBlocker] = useState<number | null>(null);
  const [expandedStrength, setExpandedStrength] = useState<number | null>(null);

  const hostname = new URL(result.url).hostname;
  const firstLetter = hostname.charAt(0).toUpperCase();

  const getScoreClass = (score: number) => {
    if (score >= 70) return styles.good;
    if (score >= 40) return styles.okay;
    return styles.bad;
  };

  const getVerdict = (score: number) => {
    if (score >= 70) return { text: 'confidently recommend you', highlight: 'confidently' };
    if (score >= 40) return { text: 'hesitate to recommend you', highlight: 'hesitate' };
    return { text: 'struggle to recommend you', highlight: 'struggle' };
  };

  const verdict = getVerdict(result.scores.total);

  const getSeverityClass = (severity: number) => {
    if (severity >= 80) return styles.critical;
    if (severity >= 60) return styles.high;
    return styles.medium;
  };

  const getImpactClass = (impact: number) => {
    if (impact >= 80) return styles.impactHigh;
    if (impact >= 65) return styles.impactMedium;
    return styles.impactLow;
  };

  const pillars = [
    { name: 'Language Clarity', key: 'clarity', score: result.scores.pillars.clarity },
    { name: 'Specificity', key: 'specificity', score: result.scores.pillars.specificity },
    { name: 'Proof Points', key: 'proof', score: result.scores.pillars.proof },
    { name: 'Audience Clarity', key: 'audience', score: result.scores.pillars.audience },
  ];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              <div className={styles.headerLogo}>
                <span className={styles.logoText}>CONKORD</span>
              </div>
              <div className={styles.projectSelector}>
                <div className={styles.projectFavicon}>{firstLetter}</div>
                <span>{hostname}</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.btnSecondary} onClick={onRescan}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Re-scan
              </button>
              <button className={styles.btnSecondary} onClick={onNewSite}>
                New Site
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className="container">
          <div className={styles.statsRow}>
            <div className={styles.scoreCard}>
              <div className={styles.scoreLabel}>Conkord Score</div>
              <div className={styles.scoreValue}>{result.scores.total}</div>
              <div className={styles.scoreVerdict}>
                AI would <strong>{verdict.highlight}</strong> to recommend you
              </div>
            </div>

            <div className={styles.understandingCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>How AI Understands You</span>
              </div>
              <div className={styles.understandingQuote}>
                {result.understanding.oneLiner}
              </div>
              <div className={styles.understandingMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Category</span>
                  <span className={styles.metaValue}>{result.understanding.category}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Audience</span>
                  <span className={styles.metaValue}>{result.understanding.audience}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Confidence</span>
                  <span className={`${styles.metaValue} ${styles.confidenceValue}`}>
                    {result.understanding.confidence.level} ({result.understanding.confidence.score}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.pillarsGrid}>
            {pillars.map((pillar) => (
              <div key={pillar.key} className={styles.pillarCard}>
                <div className={styles.pillarHeader}>
                  <span className={styles.pillarName}>{pillar.name}</span>
                  <span className={`${styles.pillarScore} ${getScoreClass(pillar.score)}`}>
                    {pillar.score}
                  </span>
                </div>
                <div className={styles.pillarBar}>
                  <div
                    className={`${styles.pillarBarFill} ${getScoreClass(pillar.score)}`}
                    style={{ width: `${pillar.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {result.strengths && result.strengths.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <h2 className={`${styles.sectionTitle} ${styles.strengthsTitle}`}>What's Working Well</h2>
                <span className={`${styles.sectionCount} ${styles.strengthsCount}`}>{result.strengths.length} strengths found</span>
              </div>

              <div className={styles.strengthsList}>
                {result.strengths.map((strength, index) => (
                  <div
                    key={strength.code}
                    className={`${styles.strengthCard} ${expandedStrength === index ? styles.expanded : ''}`}
                    onClick={() => setExpandedStrength(expandedStrength === index ? null : index)}
                  >
                    <div className={styles.strengthMain}>
                      <div className={`${styles.strengthImpact} ${getImpactClass(strength.impact)}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <div className={styles.strengthContent}>
                        <div className={styles.strengthTitle}>{strength.title}</div>
                        <div className={styles.strengthDescription}>{strength.description}</div>
                      </div>
                      <div className={styles.strengthMeta}>
                        <span className={styles.strengthPillar}>{strength.pillar}</span>
                        <svg className={styles.strengthArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>

                    {expandedStrength === index && (
                      <div className={styles.strengthExpanded}>
                        <div className={styles.evidenceSection}>
                          <div className={styles.evidenceLabel}>Evidence</div>
                          {strength.evidence.map((e, i) => (
                            <div key={i} className={styles.evidenceItem}>
                              <div className={styles.evidenceUrl}>{e.url}</div>
                              <div className={styles.evidenceSnippet}>{e.snippet}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Selection Blockers</h2>
            <span className={styles.sectionCount}>{result.blockers.length} issues found</span>
          </div>

          <div className={styles.blockersList}>
            {result.blockers.map((blocker, index) => (
              <div
                key={blocker.code}
                className={`${styles.blockerCard} ${expandedBlocker === index ? styles.expanded : ''}`}
                onClick={() => setExpandedBlocker(expandedBlocker === index ? null : index)}
              >
                <div className={styles.blockerMain}>
                  <div className={`${styles.blockerSeverity} ${getSeverityClass(blocker.severity)}`}>
                    {blocker.severity}
                  </div>
                  <div className={styles.blockerContent}>
                    <div className={styles.blockerTitle}>{blocker.title}</div>
                    <div className={styles.blockerDescription}>{blocker.description}</div>
                  </div>
                  <div className={styles.blockerMeta}>
                    <span className={styles.blockerPillar}>{blocker.pillar}</span>
                    <svg className={styles.blockerArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>

                {expandedBlocker === index && (
                  <div className={styles.blockerExpanded}>
                    <div className={styles.evidenceSection}>
                      <div className={styles.evidenceLabel}>Evidence</div>
                      {blocker.evidence.map((e, i) => (
                        <div key={i} className={styles.evidenceItem}>
                          <div className={styles.evidenceUrl}>{e.url}</div>
                          <div className={styles.evidenceSnippet}>{e.snippet}</div>
                        </div>
                      ))}
                    </div>
                    <p className={styles.whyHurts}>
                      <strong>How to fix:</strong> {blocker.fixStrategy}
                    </p>
                    <div className={styles.blockerActions}>
                      <button
                        className={styles.btnFix}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRewrite(blocker);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                        </svg>
                        Generate Fix
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.understanding.confusions.length > 0 && (
            <div className={styles.confusionsSection}>
              <h3 className={styles.confusionsTitle}>AI Confusions Detected</h3>
              <ul className={styles.confusionsList}>
                {result.understanding.confusions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
