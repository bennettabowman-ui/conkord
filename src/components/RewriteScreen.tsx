'use client';

import { useState, useEffect } from 'react';
import styles from './RewriteScreen.module.css';
import { AnalysisResult } from '@/app/page';

interface RewriteScreenProps {
  blocker: AnalysisResult['blockers'][0];
  siteName: string;
  onBack: () => void;
}

interface Patch {
  page: string;
  section: string;
  type: string;
  before: string;
  after: string;
  rationale: string;
}

export default function RewriteScreen({ blocker, siteName, onBack }: RewriteScreenProps) {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    // Generate mock patches based on blocker type
    const generatedPatches = generatePatchesForBlocker(blocker, siteName);
    setTimeout(() => {
      setPatches(generatedPatches);
      setLoading(false);
    }, 1500);
  }, [blocker, siteName]);

  const copyPatch = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <button className={styles.btnBack} onClick={onBack}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6"></path>
              </svg>
            </button>
            <div className={styles.titleSection}>
              <div className={styles.label}>Fix for blocker</div>
              <h1 className={styles.title}>{blocker.title}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className="container">
          <div className={styles.intro}>
            <h3>What we're fixing</h3>
            <p>{blocker.fixStrategy}</p>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Generating fix suggestions...</p>
            </div>
          ) : (
            <div className={styles.patchesList}>
              {patches.map((patch, index) => (
                <div key={index} className={styles.patchCard}>
                  <div className={styles.patchHeader}>
                    <div className={styles.patchLocation}>
                      <span className={styles.patchPage}>{patch.page}</span>
                      <span className={styles.patchSection}>→ {patch.section}</span>
                    </div>
                    <span className={styles.patchType}>{patch.type}</span>
                  </div>
                  <div className={styles.patchDiff}>
                    <div className={`${styles.diffSide} ${styles.before}`}>
                      <div className={styles.diffLabel}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14"></path>
                        </svg>
                        Before
                      </div>
                      <div className={styles.diffContent}>
                        {patch.before || <em className={styles.noContent}>(No content — this section doesn't exist)</em>}
                      </div>
                    </div>
                    <div className={`${styles.diffSide} ${styles.after}`}>
                      <div className={styles.diffLabel}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14"></path>
                          <path d="M12 5v14"></path>
                        </svg>
                        After
                      </div>
                      <div className={styles.diffContent}>{patch.after}</div>
                    </div>
                  </div>
                  <div className={styles.patchFooter}>
                    <div className={styles.patchRationale}>{patch.rationale}</div>
                    <button
                      className={`${styles.btnCopy} ${copied === index ? styles.copied : ''}`}
                      onClick={() => copyPatch(index, patch.after)}
                    >
                      {copied === index ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function generatePatchesForBlocker(blocker: AnalysisResult['blockers'][0], siteName: string): Patch[] {
  const site = siteName.replace(/^www\./, '').split('.')[0];
  const siteCapitalized = site.charAt(0).toUpperCase() + site.slice(1);

  switch (blocker.code) {
    case 'CLARITY_VAGUE_HERO':
    case 'CLARITY_NO_DEFINITION':
      return [
        {
          page: siteName,
          section: 'Hero headline',
          type: 'Definition',
          before: blocker.evidence[0]?.snippet || 'Supercharge your team\'s potential',
          after: `${siteCapitalized} is a [your product type] that helps [your audience] [achieve specific outcome]`,
          rationale: 'Adds explicit category, audience, and outcome',
        },
        {
          page: siteName,
          section: 'Below hero (new section)',
          type: 'What We Are / Are Not',
          before: '',
          after: `${siteCapitalized} is:\n• A [specific product type] for [specific audience]\n• Built for [specific use case]\n• Designed for [specific workflow]\n\n${siteCapitalized} is not:\n• A simple [common alternative]\n• An enterprise [overbuilt alternative]\n• A replacement for [different category]`,
          rationale: 'Boundaries help AI know when to recommend you (and when not to)',
        },
      ];

    case 'SPECIFICITY_NO_EXAMPLES':
      return [
        {
          page: siteName + '/customers',
          section: 'Case study',
          type: 'Client Example',
          before: 'No case studies found',
          after: `How [Client Name] achieved [specific result]\n\nThe Challenge: [Client] was struggling with [specific problem].\n\nThe Solution: We implemented [specific approach].\n\nThe Result: [Metric] improved by [X%] within [timeframe].`,
          rationale: 'Specific examples show AI what you actually do',
        },
      ];

    case 'SPECIFICITY_NO_OUTCOMES':
      return [
        {
          page: siteName,
          section: 'Results section',
          type: 'Metrics',
          before: 'Save time and boost productivity',
          after: 'Teams using ${siteCapitalized} report:\n• 40% faster [process]\n• $50,000 average annual savings\n• 3x improvement in [metric]',
          rationale: 'Specific numbers make claims verifiable and trustworthy',
        },
      ];

    case 'PROOF_NO_CASE_STUDIES':
      return [
        {
          page: siteName + '/case-studies',
          section: 'New page',
          type: 'Case Study',
          before: '',
          after: `Case Study: [Client Name]\n\nIndustry: [Industry]\nCompany Size: [Size]\nChallenge: [Specific problem]\n\nOur Approach:\n[What you did]\n\nResults:\n• [Metric 1]: [Before] → [After]\n• [Metric 2]: [X% improvement]\n• [Metric 3]: $[Amount] saved`,
          rationale: 'Detailed case studies give AI confidence to recommend you',
        },
      ];

    case 'PROOF_NO_TESTIMONIALS':
      return [
        {
          page: siteName,
          section: 'Testimonials',
          type: 'Quote',
          before: 'No testimonials found',
          after: `"We switched to ${siteCapitalized} and saw [specific result] within [timeframe]. The [specific feature] alone saved our team [X hours/dollars] per month."\n\n— [Full Name], [Title] at [Company]`,
          rationale: 'Attributed quotes with specific details build credibility',
        },
      ];

    case 'AUDIENCE_NOT_SPECIFIC':
    case 'AUDIENCE_NO_SIZE':
      return [
        {
          page: siteName,
          section: 'Hero or About',
          type: 'Audience Clarity',
          before: 'For companies and teams',
          after: `Built for [specific role] at [company size] [industry] companies who need [specific capability]`,
          rationale: 'Specific audience helps AI match you to the right queries',
        },
        {
          page: siteName + '/about',
          section: 'Who we serve',
          type: 'Audience Section',
          before: '',
          after: `Who ${siteCapitalized} is for:\n\n• [Role 1] at [Company Type 1]\n• [Role 2] at [Company Type 2]\n• Teams of [size range] who [do what]`,
          rationale: 'Explicit audience list helps AI recommend you correctly',
        },
      ];

    default:
      return [
        {
          page: siteName,
          section: 'Various',
          type: 'General Fix',
          before: blocker.evidence[0]?.snippet || 'Current content',
          after: `[Improved content addressing: ${blocker.title}]`,
          rationale: blocker.fixStrategy,
        },
      ];
  }
}
