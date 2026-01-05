'use client';

import { useState } from 'react';
import styles from './LandingScreen.module.css';

interface LandingScreenProps {
  onAnalyze: (url: string) => void;
}

export default function LandingScreen({ onAnalyze }: LandingScreenProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    onAnalyze(fullUrl);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.bg}></div>
      <div className={styles.grid}></div>

      <div className={styles.content}>
        <div className={styles.logo}>
          <span className={styles.logoText}>CONKORD</span>
        </div>

        <h1 className={styles.headline}>
          Make AI <span className={styles.highlight}>confident</span> about you
        </h1>

        <p className={styles.subhead}>
          Discover why AI hesitates to recommend your product—and get exact fixes to become the obvious choice.
        </p>

        <form onSubmit={handleSubmit} className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.input}
            placeholder="Enter your website URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className={styles.button} disabled={isLoading || !url.trim()}>
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </form>

        <div className={styles.features}>
          <div className={styles.feature}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>See how AI understands you</span>
          </div>
          <div className={styles.feature}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Find selection blockers</span>
          </div>
          <div className={styles.feature}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Get exact rewrites</span>
          </div>
        </div>
      </div>
    </div>
  );
}
