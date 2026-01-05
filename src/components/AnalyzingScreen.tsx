'use client';

import styles from './AnalyzingScreen.module.css';
import { AnalysisStep } from '@/app/page';

interface AnalyzingScreenProps {
  url: string;
  steps: AnalysisStep[];
  error: string | null;
}

export default function AnalyzingScreen({ url, steps, error }: AnalyzingScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.visual}>
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
          <div className={styles.core}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>
        </div>

        <h2 className={styles.title}>
          {error ? 'Analysis Failed' : 'Analyzing your site'}
        </h2>
        <p className={styles.url}>{url}</p>

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <p className={styles.errorHint}>Returning to home...</p>
          </div>
        )}

        {!error && (
          <div className={styles.steps}>
            {steps.map((step) => (
              <div key={step.id} className={styles.step}>
                <div className={`${styles.stepIcon} ${styles[step.status]}`}>
                  {step.status === 'done' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : step.status === 'active' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                  )}
                </div>
                <span className={`${styles.stepText} ${step.status === 'active' ? styles.activeText : ''}`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
