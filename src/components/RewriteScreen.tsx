'use client';

import { useState, useEffect } from 'react';
import styles from './RewriteScreen.module.css';
import { AnalysisResult } from '@/app/page';

interface RewriteScreenProps {
  blocker: AnalysisResult['blockers'][0];
  siteName: string;
  siteInfo?: {
    description?: string;
    category?: string;
    audience?: string;
    faqs?: Array<{ question: string; answer: string }>;
  };
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

interface SchemaOutput {
  html: string;
  instructions: string;
}

// Check if this is a schema-related blocker
function isSchemaBlocker(code: string): boolean {
  return code.startsWith('SPECIFICITY_NO_SCHEMA') ||
    code.startsWith('SPECIFICITY_NO_ORG') ||
    code.startsWith('PROOF_NO_REVIEW_SCHEMA') ||
    code.startsWith('SPECIFICITY_NO_FAQ');
}

// Check if this is a llms.txt blocker
function isLlmsTxtBlocker(code: string): boolean {
  return code === 'CLARITY_NO_LLMS_TXT' || code === 'CLARITY_LLMS_TXT_MISALIGNED';
}

function getSchemaType(code: string): 'organization' | 'product' | 'faq' | 'review' | 'all' {
  if (code === 'SPECIFICITY_NO_SCHEMA') return 'all';
  if (code === 'SPECIFICITY_NO_ORG_SCHEMA') return 'organization';
  if (code === 'PROOF_NO_REVIEW_SCHEMA') return 'review';
  if (code === 'SPECIFICITY_NO_FAQ_SCHEMA') return 'faq';
  return 'all';
}

interface LlmsTxtOutput {
  content: string;
  instructions: string;
}

export default function RewriteScreen({ blocker, siteName, siteInfo, onBack }: RewriteScreenProps) {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [schemaOutput, setSchemaOutput] = useState<SchemaOutput | null>(null);
  const [llmsTxtOutput, setLlmsTxtOutput] = useState<LlmsTxtOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [llmsTxtCopied, setLlmsTxtCopied] = useState(false);

  const isSchema = isSchemaBlocker(blocker.code);
  const isLlmsTxt = isLlmsTxtBlocker(blocker.code);

  useEffect(() => {
    if (isSchema) {
      // Generate schema via API
      generateSchema();
    } else if (isLlmsTxt) {
      // Generate llms.txt via API
      generateLlmsTxt();
    } else {
      // Generate copy patches
      const generatedPatches = generatePatchesForBlocker(blocker, siteName);
      setTimeout(() => {
        setPatches(generatedPatches);
        setLoading(false);
      }, 1500);
    }
  }, [blocker, siteName]);

  const generateSchema = async () => {
    try {
      const response = await fetch('/api/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaType: getSchemaType(blocker.code),
          siteInfo: {
            url: `https://${siteName}`,
            name: siteName.replace(/^www\./, '').split('.')[0].charAt(0).toUpperCase() +
              siteName.replace(/^www\./, '').split('.')[0].slice(1),
            description: siteInfo?.description || '',
            category: siteInfo?.category || '',
            audience: siteInfo?.audience || '',
            faqs: siteInfo?.faqs || [],
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSchemaOutput({
          html: data.html,
          instructions: data.instructions,
        });
      }
    } catch (error) {
      console.error('Schema generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyPatch = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const copySchema = () => {
    if (schemaOutput?.html) {
      navigator.clipboard.writeText(schemaOutput.html);
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    }
  };

  const generateLlmsTxt = async () => {
    try {
      const response = await fetch('/api/generate-llms-txt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteInfo: {
            url: `https://${siteName}`,
            name: siteName.replace(/^www\./, '').split('.')[0].charAt(0).toUpperCase() +
              siteName.replace(/^www\./, '').split('.')[0].slice(1),
            description: siteInfo?.description || '',
            category: siteInfo?.category || '',
            audience: siteInfo?.audience || '',
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLlmsTxtOutput({
          content: data.content,
          instructions: data.instructions,
        });
      }
    } catch (error) {
      console.error('llms.txt generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLlmsTxt = () => {
    if (llmsTxtOutput?.content) {
      navigator.clipboard.writeText(llmsTxtOutput.content);
      setLlmsTxtCopied(true);
      setTimeout(() => setLlmsTxtCopied(false), 2000);
    }
  };

  // Get the appropriate label for the header
  const getHeaderLabel = () => {
    if (isSchema) return 'Generate schema for';
    if (isLlmsTxt) return 'Generate llms.txt for';
    return 'Fix for blocker';
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
              <div className={styles.label}>{getHeaderLabel()}</div>
              <h1 className={styles.title}>{blocker.title}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div className="container">
          <div className={styles.intro}>
            <h3>{isSchema ? 'Why schema matters' : isLlmsTxt ? 'Why llms.txt matters' : 'What we\'re fixing'}</h3>
            <p>{blocker.fixStrategy}</p>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>{isSchema ? 'Generating schema markup...' : isLlmsTxt ? 'Generating llms.txt...' : 'Generating fix suggestions...'}</p>
            </div>
          ) : isLlmsTxt && llmsTxtOutput ? (
            <div className={styles.schemaOutput}>
              <div className={styles.schemaCard}>
                <div className={styles.schemaHeader}>
                  <div className={styles.schemaTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    llms.txt
                  </div>
                  <button
                    className={`${styles.btnCopy} ${llmsTxtCopied ? styles.copied : ''}`}
                    onClick={copyLlmsTxt}
                  >
                    {llmsTxtCopied ? (
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
                        Copy All
                      </>
                    )}
                  </button>
                </div>
                <pre className={styles.schemaCode}>{llmsTxtOutput.content}</pre>
              </div>

              <div className={styles.instructionsCard}>
                <h3 className={styles.instructionsTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                  </svg>
                  Implementation Instructions
                </h3>
                <div className={styles.instructionsContent}>
                  {llmsTxtOutput.instructions.split('\n').map((line, i) => {
                    if (line.startsWith('##')) {
                      return <h4 key={i} className={styles.instructionHeading}>{line.replace('## ', '')}</h4>;
                    }
                    if (line.startsWith('###')) {
                      return <h5 key={i} className={styles.instructionSubheading}>{line.replace('### ', '')}</h5>;
                    }
                    if (line.startsWith('```')) {
                      return null;
                    }
                    if (line.startsWith('`') && line.endsWith('`')) {
                      return <code key={i} style={{ display: 'block', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '4px', marginBottom: '8px' }}>{line.slice(1, -1)}</code>;
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            </div>
          ) : isSchema && schemaOutput ? (
            <div className={styles.schemaOutput}>
              <div className={styles.schemaCard}>
                <div className={styles.schemaHeader}>
                  <div className={styles.schemaTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    JSON-LD Schema Markup
                  </div>
                  <button
                    className={`${styles.btnCopy} ${schemaCopied ? styles.copied : ''}`}
                    onClick={copySchema}
                  >
                    {schemaCopied ? (
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
                        Copy All
                      </>
                    )}
                  </button>
                </div>
                <pre className={styles.schemaCode}>{schemaOutput.html}</pre>
              </div>

              <div className={styles.instructionsCard}>
                <h3 className={styles.instructionsTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                  </svg>
                  Implementation Instructions
                </h3>
                <div className={styles.instructionsContent}>
                  {schemaOutput.instructions.split('\n').map((line, i) => {
                    if (line.startsWith('##')) {
                      return <h4 key={i} className={styles.instructionHeading}>{line.replace('## ', '')}</h4>;
                    }
                    if (line.startsWith('###')) {
                      return <h5 key={i} className={styles.instructionSubheading}>{line.replace('### ', '')}</h5>;
                    }
                    if (line.startsWith('```')) {
                      return null; // Skip code fence markers
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
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
