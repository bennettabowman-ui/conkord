import { NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Stream helper for real-time updates
function createStreamResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  const send = (data: object) => {
    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
  };

  const close = () => {
    controller.close();
  };

  return { stream, send, close };
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  const { stream, send, close } = createStreamResponse();

  // Run analysis in background
  (async () => {
    try {
      const startTime = Date.now();

      // Step 1: Crawl
      send({ type: 'step', step: 1, message: 'Crawling pages' });
      const crawlResult = await crawlSite(url);

      if (!crawlResult.success) {
        send({ type: 'error', error: crawlResult.error });
        close();
        return;
      }

      // Step 2: Extract
      send({ type: 'step', step: 2, message: 'Extracting content' });
      const extractions = [];
      for (const page of crawlResult.pages) {
        const extraction = extractPage(page.html, page.url, page.type);
        extractions.push(extraction);
      }
      const siteData = combineSiteExtractions(extractions);

      // Step 3: AI Understanding
      send({ type: 'step', step: 3, message: 'Building AI understanding' });
      const understanding = await generateUnderstanding(siteData, extractions);

      // Step 4: Blockers
      send({ type: 'step', step: 4, message: 'Identifying blockers' });
      const blockers = runBlockerChecks(siteData, extractions);

      // Step 5: Scores
      send({ type: 'step', step: 5, message: 'Calculating score' });

      // Check llms.txt alignment
      const llmsTxtAnalysis = analyzeLlmsTxt(crawlResult.llmsTxt ?? null, siteData, understanding);
      const scores = calculateScores(blockers, llmsTxtAnalysis.modifier);

      const elapsed = (Date.now() - startTime) / 1000;

      const result = {
        success: true,
        url: crawlResult.origin,
        analyzedAt: new Date().toISOString(),
        elapsedSeconds: parseFloat(elapsed.toFixed(1)),
        pagesAnalyzed: crawlResult.crawledCount,
        scores,
        understanding,
        blockers,
        llmsTxt: llmsTxtAnalysis,
      };

      send({ type: 'complete', result });
      close();
    } catch (error) {
      send({ type: 'error', error: error instanceof Error ? error.message : 'Analysis failed' });
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

// ============================================
// CRAWLER
// ============================================

async function crawlSite(baseUrl: string) {
  const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
  const origin = urlObj.origin;

  const priorityPaths = [
    '/',
    '/about',
    '/about-us',
    '/pricing',
    '/features',
    '/product',
    '/solutions',
    '/faq',
  ];

  const results: Array<{ url: string; type: string; html: string }> = [];
  const crawled = new Set<string>();

  // Crawl homepage
  const homepageResult = await fetchPage(origin);
  if (!homepageResult.success) {
    return { success: false, error: homepageResult.error, pages: [] };
  }

  results.push({ url: origin, type: 'homepage', html: homepageResult.html! });
  crawled.add(origin);
  crawled.add(origin + '/');

  // Check for llms.txt
  let llmsTxt: string | null = null;
  try {
    const llmsResult = await fetchPage(origin + '/llms.txt');
    if (llmsResult.success && llmsResult.html) {
      llmsTxt = llmsResult.html;
    }
  } catch {
    // No llms.txt, that's fine
  }

  // Extract links from homepage
  const $ = cheerio.load(homepageResult.html!);
  const discoveredLinks = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const linkUrl = new URL(href, origin);
        if (linkUrl.origin === origin) {
          discoveredLinks.add(linkUrl.pathname);
        }
      } catch {
        // Invalid URL
      }
    }
  });

  const allPaths = [...new Set([...priorityPaths, ...discoveredLinks])];

  // Crawl additional pages (max 8)
  for (const path of allPaths) {
    if (results.length >= 8) break;

    const pageUrl = origin + path;
    if (crawled.has(pageUrl)) continue;
    if (shouldSkipPath(path)) continue;

    const pageResult = await fetchPage(pageUrl);
    if (pageResult.success) {
      results.push({
        url: pageUrl,
        type: detectPageType(path),
        html: pageResult.html!,
      });
      crawled.add(pageUrl);
    }

    await sleep(300);
  }

  return {
    success: true,
    origin,
    pages: results,
    crawledCount: results.length,
    llmsTxt,
  };
}

async function fetchPage(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return { success: true, html };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' };
  }
}

function detectPageType(path: string): string {
  const p = path.toLowerCase();
  if (p === '/' || p === '') return 'homepage';
  if (p.includes('pricing')) return 'pricing';
  if (p.includes('about')) return 'about';
  if (p.includes('feature')) return 'features';
  if (p.includes('product')) return 'product';
  if (p.includes('faq')) return 'faq';
  return 'other';
}

function shouldSkipPath(path: string): boolean {
  const skipPatterns = [
    /\.(png|jpg|jpeg|gif|svg|css|js|pdf|zip)$/i,
    /^\/(wp-|admin|login|signup|cart|checkout|account)/i,
    /^\/(tag|category|author)\//i,
    /\?/,
    /#/,
  ];
  return skipPatterns.some(pattern => pattern.test(path));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EXTRACTOR
// ============================================

interface SchemaData {
  types: string[];
  hasOrganization: boolean;
  hasProduct: boolean;
  hasReview: boolean;
  hasFAQ: boolean;
  hasHowTo: boolean;
  raw: object[];
}

function extractSchema($: cheerio.CheerioAPI): SchemaData {
  const schemaData: SchemaData = {
    types: [],
    hasOrganization: false,
    hasProduct: false,
    hasReview: false,
    hasFAQ: false,
    hasHowTo: false,
    raw: [],
  };

  // Extract JSON-LD schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        const schemas = Array.isArray(parsed) ? parsed : [parsed];

        for (const schema of schemas) {
          if (schema['@type']) {
            const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
            schemaData.types.push(...types);

            for (const type of types) {
              const typeLower = type.toLowerCase();
              if (typeLower.includes('organization') || typeLower.includes('localbusiness')) {
                schemaData.hasOrganization = true;
              }
              if (typeLower.includes('product') || typeLower.includes('softwareapplication')) {
                schemaData.hasProduct = true;
              }
              if (typeLower.includes('review') || typeLower.includes('aggregaterating')) {
                schemaData.hasReview = true;
              }
              if (typeLower.includes('faqpage') || typeLower.includes('question')) {
                schemaData.hasFAQ = true;
              }
              if (typeLower.includes('howto')) {
                schemaData.hasHowTo = true;
              }
            }
          }

          // Handle @graph structure
          if (schema['@graph'] && Array.isArray(schema['@graph'])) {
            for (const item of schema['@graph']) {
              if (item['@type']) {
                const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                schemaData.types.push(...types);

                for (const type of types) {
                  const typeLower = type.toLowerCase();
                  if (typeLower.includes('organization')) schemaData.hasOrganization = true;
                  if (typeLower.includes('product')) schemaData.hasProduct = true;
                  if (typeLower.includes('review') || typeLower.includes('rating')) schemaData.hasReview = true;
                  if (typeLower.includes('faq') || typeLower.includes('question')) schemaData.hasFAQ = true;
                  if (typeLower.includes('howto')) schemaData.hasHowTo = true;
                }
              }
            }
          }

          schemaData.raw.push(schema);
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  // Dedupe types
  schemaData.types = [...new Set(schemaData.types)];

  return schemaData;
}

interface Extraction {
  url: string;
  pageType: string;
  meta: { title: string; description: string };
  headings: Array<{ level: string; text: string }>;
  hero: { headline: string; subheadline: string };
  paragraphs: string[];
  lists: string[][];
  definitionStatements: string[];
  audienceStatements: string[];
  claims: string[];
  proofPoints: string[];
  faqs: Array<{ question: string; answer: string }>;
  schema: SchemaData;
}

function extractPage(html: string, url: string, pageType: string): Extraction {
  const $raw = cheerio.load(html);

  // Extract schema markup before removing scripts
  const schemaData = extractSchema($raw);

  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, nav, footer, header, aside').remove();

  const extraction: Extraction = {
    url,
    pageType,
    meta: {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
    },
    headings: [],
    hero: { headline: '', subheadline: '' },
    paragraphs: [],
    lists: [],
    definitionStatements: [],
    audienceStatements: [],
    claims: [],
    proofPoints: [],
    faqs: [],
    schema: schemaData,
  };

  // Extract headings
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 2 && text.length < 300) {
      extraction.headings.push({ level: el.tagName.toLowerCase(), text });
    }
  });

  // Extract hero
  extraction.hero.headline = $('h1').first().text().trim();
  const h1Parent = $('h1').first().parent();
  const subheadline = h1Parent.find('p').first().text().trim() ||
    $('h1').first().next('p').text().trim();
  if (subheadline && subheadline.length > 20 && subheadline.length < 500) {
    extraction.hero.subheadline = subheadline;
  }

  // Extract paragraphs
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30 && text.length < 2000) {
      extraction.paragraphs.push(text);
    }
  });
  extraction.paragraphs = extraction.paragraphs.slice(0, 30);

  // Extract lists
  $('ul, ol').each((_, el) => {
    const items: string[] = [];
    $(el).find('li').each((_, li) => {
      const text = $(li).text().trim();
      if (text && text.length < 500) items.push(text);
    });
    if (items.length > 0 && items.length < 20) {
      extraction.lists.push(items);
    }
  });

  // Extract FAQs
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('?') || text.toLowerCase().startsWith('what') ||
        text.toLowerCase().startsWith('how') || text.toLowerCase().startsWith('why')) {
      const answer = $(el).next('p').text().trim();
      if (answer && answer.length > 20) {
        extraction.faqs.push({ question: text, answer: answer.slice(0, 500) });
      }
    }
  });

  // Semantic extraction
  const allText = [
    extraction.hero.headline,
    extraction.hero.subheadline,
    ...extraction.headings.map(h => h.text),
    ...extraction.paragraphs,
  ].filter(Boolean);

  extraction.definitionStatements = findDefinitionStatements(allText);
  extraction.audienceStatements = findAudienceStatements(allText);
  extraction.claims = findClaims(allText);
  extraction.proofPoints = findProofPoints(allText);

  return extraction;
}

function findDefinitionStatements(texts: string[]): string[] {
  const definitions: string[] = [];
  const patterns = [
    /\b(\w+)\s+is\s+(?:a|an|the)\s+([^.]+)/gi,
    /\bwe\s+(?:are|provide|offer|build)\s+(?:a|an|the)?\s*([^.]+)/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) definitions.push(...matches.map(m => m.trim()));
    }
  }
  return [...new Set(definitions)].slice(0, 10);
}

function findAudienceStatements(texts: string[]): string[] {
  const audiences: string[] = [];
  const patterns = [
    /\b(?:for|built for|designed for)\s+([^.]+?)(?:\.|,|$)/gi,
    /\bhelps?\s+([^.]+?)\s+(?:to|by|with)/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) audiences.push(...matches.map(m => m.trim()));
    }
  }
  return [...new Set(audiences)].slice(0, 10);
}

function findClaims(texts: string[]): string[] {
  const claims: string[] = [];
  const patterns = [
    /\b(?:increase|boost|improve|reduce|save)\s+([^.]+)/gi,
    /\b\d+%\s+(?:faster|better|more|less)[^.]*/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) claims.push(...matches.map(m => m.trim()));
    }
  }
  return [...new Set(claims)].slice(0, 15);
}

function findProofPoints(texts: string[]): string[] {
  const proofPoints: string[] = [];
  const patterns = [
    /\b(\d{1,3}(?:,\d{3})*\+?)\s*(?:customers?|users?|teams?)/gi,
    /\b(?:trusted by|used by)\s+(\d{1,3}(?:,\d{3})*\+?)/gi,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) proofPoints.push(...matches.map(m => m.trim()));
    }
  }
  return [...new Set(proofPoints)].slice(0, 15);
}

interface SiteData {
  homepage: Extraction | null;
  allHeadings: Array<{ level: string; text: string }>;
  allDefinitions: string[];
  allAudienceStatements: string[];
  allClaims: string[];
  allProofPoints: string[];
  allFAQs: Array<{ question: string; answer: string }>;
  pageTypes: Record<string, Extraction>;
}

function combineSiteExtractions(extractions: Extraction[]): SiteData {
  const combined: SiteData = {
    homepage: null,
    allHeadings: [],
    allDefinitions: [],
    allAudienceStatements: [],
    allClaims: [],
    allProofPoints: [],
    allFAQs: [],
    pageTypes: {},
  };

  for (const extraction of extractions) {
    combined.pageTypes[extraction.pageType] = extraction;
    if (extraction.pageType === 'homepage') {
      combined.homepage = extraction;
    }
    combined.allHeadings.push(...extraction.headings);
    combined.allDefinitions.push(...extraction.definitionStatements);
    combined.allAudienceStatements.push(...extraction.audienceStatements);
    combined.allClaims.push(...extraction.claims);
    combined.allProofPoints.push(...extraction.proofPoints);
    combined.allFAQs.push(...extraction.faqs);
  }

  combined.allDefinitions = [...new Set(combined.allDefinitions)];
  combined.allAudienceStatements = [...new Set(combined.allAudienceStatements)];
  combined.allClaims = [...new Set(combined.allClaims)];
  combined.allProofPoints = [...new Set(combined.allProofPoints)];

  return combined;
}

// ============================================
// UNDERSTANDING (GPT)
// ============================================

interface Understanding {
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
}

async function generateUnderstanding(siteData: SiteData, extractions: Extraction[]): Promise<Understanding> {
  try {
    const siteContent = buildSiteContentSummary(siteData);

    const prompt = `You are evaluating a company's website to understand what they do. Based on the content below, provide a structured analysis.

Here is the extracted content from their website:

---
${siteContent}
---

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "oneLiner": "A single sentence describing what this company/product does. Be specific and concrete.",
  "category": "The product category (e.g., Project Management, CRM, Analytics, etc.)",
  "audience": "Who this product is for (be specific: company size, roles, industries)",
  "useCases": ["Use case 1", "Use case 2", "Use case 3"],
  "confusions": ["Anything unclear or confusing about their messaging"],
  "missingForConfidence": ["Information that would help you recommend them more confidently"],
  "confidenceScore": 75,
  "confidenceLevel": "Medium",
  "confidenceReason": "Brief explanation of your confidence level"
}

Be honest and specific. If something is unclear, say so.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    const cleanJson = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      oneLiner: parsed.oneLiner || 'Unable to determine',
      category: parsed.category || 'Unclear',
      audience: parsed.audience || 'Not clearly specified',
      useCases: parsed.useCases || [],
      confusions: parsed.confusions || [],
      missingForConfidence: parsed.missingForConfidence || [],
      confidence: {
        score: parsed.confidenceScore || 50,
        level: parsed.confidenceLevel || 'Medium',
        reason: parsed.confidenceReason || 'AI analysis completed',
      },
    };
  } catch {
    // Fallback
    return {
      oneLiner: siteData.homepage?.hero.headline || 'Unable to determine',
      category: 'Unknown',
      audience: 'Not specified',
      useCases: [],
      confusions: ['Could not analyze with AI'],
      missingForConfidence: [],
      confidence: { score: 30, level: 'Low', reason: 'Fallback mode' },
    };
  }
}

function buildSiteContentSummary(siteData: SiteData): string {
  const parts: string[] = [];

  const homepage = siteData.homepage;
  if (homepage) {
    parts.push('=== HOMEPAGE ===');
    if (homepage.meta.title) parts.push(`Title: ${homepage.meta.title}`);
    if (homepage.meta.description) parts.push(`Meta: ${homepage.meta.description}`);
    if (homepage.hero.headline) parts.push(`Headline: ${homepage.hero.headline}`);
    if (homepage.hero.subheadline) parts.push(`Subheadline: ${homepage.hero.subheadline}`);
    if (homepage.paragraphs.length > 0) {
      parts.push(`Content:\n${homepage.paragraphs.slice(0, 5).join('\n')}`);
    }
  }

  const about = siteData.pageTypes['about'];
  if (about) {
    parts.push('\n=== ABOUT PAGE ===');
    if (about.hero.headline) parts.push(`Headline: ${about.hero.headline}`);
    if (about.paragraphs.length > 0) {
      parts.push(`Content:\n${about.paragraphs.slice(0, 3).join('\n')}`);
    }
  }

  if (siteData.allDefinitions.length > 0) {
    parts.push('\n=== DEFINITIONS FOUND ===');
    parts.push(siteData.allDefinitions.slice(0, 5).join('\n'));
  }

  if (siteData.allProofPoints.length > 0) {
    parts.push('\n=== PROOF POINTS ===');
    parts.push(siteData.allProofPoints.slice(0, 5).join('\n'));
  }

  let content = parts.join('\n');
  if (content.length > 6000) {
    content = content.slice(0, 6000) + '\n[truncated]';
  }
  return content;
}

// ============================================
// BLOCKERS
// ============================================

const VAGUE_WORDS = [
  'innovative', 'cutting-edge', 'next-generation', 'world-class', 'best-in-class',
  'synergy', 'leverage', 'optimize', 'streamline', 'empower', 'enable',
  'transform', 'revolutionize', 'disrupt', 'reimagine', 'unlock', 'accelerate',
  'seamless', 'robust', 'scalable', 'dynamic', 'agile', 'flexible',
  'holistic', 'end-to-end', 'turnkey', 'comprehensive', 'integrated',
  'drive growth', 'drive results', 'make potential possible',
  'fiercely human', 'human-centered', 'thought leadership',
];

const EMPTY_PHRASES = [
  'we help companies', 'we help businesses', 'achieve their goals',
  'digital transformation', 'strategic partner', 'trusted partner',
  'customer-centric', 'results-driven', 'solutions that',
];

interface Blocker {
  code: string;
  title: string;
  description: string;
  pillar: string;
  severity: number;
  evidence: Array<{ url: string; snippet: string; location: string }>;
  fixStrategy: string;
}

function runBlockerChecks(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];

  blockers.push(...checkLanguageClarity(siteData, extractions));
  blockers.push(...checkProblemFraming(siteData, extractions));
  blockers.push(...checkSpecificity(siteData, extractions));
  blockers.push(...checkProofPoints(siteData, extractions));
  blockers.push(...checkAudienceClarity(siteData, extractions));
  blockers.push(...checkSchemaMarkup(siteData, extractions));

  blockers.sort((a, b) => b.severity - a.severity);
  return blockers;
}

// Check for schema markup - critical for AI structured data parsing
function checkSchemaMarkup(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];

  // Aggregate all schema data from all pages
  const allSchemaTypes = new Set<string>();
  let hasAnySchema = false;
  let hasOrganization = false;
  let hasReview = false;
  let hasFAQ = false;

  for (const extraction of extractions) {
    if (extraction.schema.types.length > 0) {
      hasAnySchema = true;
      extraction.schema.types.forEach(t => allSchemaTypes.add(t));
    }
    if (extraction.schema.hasOrganization) hasOrganization = true;
    if (extraction.schema.hasReview) hasReview = true;
    if (extraction.schema.hasFAQ) hasFAQ = true;
  }

  // No schema at all - major issue
  if (!hasAnySchema) {
    blockers.push({
      code: 'SPECIFICITY_NO_SCHEMA',
      title: 'No structured data (schema markup) found',
      description: 'AI systems prioritize structured data they can parse directly. Your site has no JSON-LD schema markup, forcing AI to guess what information means.',
      pillar: 'specificity',
      severity: 82,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No JSON-LD schema detected on any page',
        location: 'All pages',
      }],
      fixStrategy: 'Add JSON-LD schema markup. At minimum: Organization schema on homepage, and Product/Service schema for your offering.',
    });
    return blockers; // Return early, other checks don't apply
  }

  // Has schema but missing Organization
  if (!hasOrganization) {
    blockers.push({
      code: 'SPECIFICITY_NO_ORG_SCHEMA',
      title: 'Missing Organization schema',
      description: 'AI cannot find structured data about who you are. Organization schema helps AI cite your company name, logo, and contact info confidently.',
      pillar: 'specificity',
      severity: 68,
      evidence: [{
        url: siteData.homepage?.url || 'Homepage',
        snippet: `Found schema types: ${[...allSchemaTypes].join(', ') || 'none'}`,
        location: 'Homepage',
      }],
      fixStrategy: 'Add Organization schema with name, description, logo, and contactPoint.',
    });
  }

  // Has schema but no review/rating signals
  if (!hasReview && siteData.allProofPoints.length > 0) {
    blockers.push({
      code: 'PROOF_NO_REVIEW_SCHEMA',
      title: 'Testimonials exist but no Review schema',
      description: 'You have social proof on your site, but AI cannot parse it as structured reviews. Adding Review/AggregateRating schema makes proof quotable.',
      pillar: 'proof',
      severity: 60,
      evidence: [{
        url: 'Site-wide',
        snippet: 'Proof points found but no Review schema',
        location: 'Content',
      }],
      fixStrategy: 'Add AggregateRating or Review schema to make your testimonials machine-readable.',
    });
  }

  // Has FAQ content but no FAQ schema
  if (!hasFAQ && siteData.allFAQs.length > 0) {
    blockers.push({
      code: 'SPECIFICITY_NO_FAQ_SCHEMA',
      title: 'FAQ content exists but no FAQPage schema',
      description: 'Your site has Q&A content that could directly match user queries, but it\'s not in schema format. FAQPage schema dramatically improves AI matching.',
      pillar: 'audience',
      severity: 55,
      evidence: [{
        url: 'Site-wide',
        snippet: `Found ${siteData.allFAQs.length} FAQ items without schema`,
        location: 'FAQ content',
      }],
      fixStrategy: 'Add FAQPage schema to your FAQ content. This directly maps to how users ask AI questions.',
    });
  }

  return blockers;
}

function checkLanguageClarity(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];
  const homepage = siteData.homepage;

  const heroText = [
    homepage?.hero?.headline || '',
    homepage?.hero?.subheadline || '',
  ].join(' ').toLowerCase();

  const vagueInHero = VAGUE_WORDS.filter(word => heroText.includes(word.toLowerCase()));
  const emptyInHero = EMPTY_PHRASES.filter(phrase => heroText.includes(phrase.toLowerCase()));

  if (vagueInHero.length >= 1 || emptyInHero.length >= 1) {
    blockers.push({
      code: 'CLARITY_VAGUE_HERO',
      title: 'Homepage headline uses vague buzzwords',
      description: "Your main headline uses empty phrases that don't tell AI what you actually do",
      pillar: 'clarity',
      severity: 90,
      evidence: [{
        url: homepage?.url || 'Homepage',
        snippet: homepage?.hero?.headline || 'No headline found',
        location: 'Homepage hero',
      }],
      fixStrategy: 'Replace vague language with specifics. Say exactly what you do and for whom.',
    });
  }

  if (siteData.allDefinitions.length === 0) {
    blockers.push({
      code: 'CLARITY_NO_DEFINITION',
      title: 'No clear description of what you do',
      description: 'AI cannot find a sentence explaining what your company does',
      pillar: 'clarity',
      severity: 92,
      evidence: [{
        url: homepage?.url || 'Homepage',
        snippet: 'No definition statement found',
        location: 'Site-wide',
      }],
      fixStrategy: 'Add one crystal-clear sentence: "[Company] is a [type] that [does what] for [whom]."',
    });
  }

  return blockers;
}

// Check if site frames problems before solutions (Gemini insight: LLMs expand queries into problems)
function checkProblemFraming(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];
  const homepage = siteData.homepage;

  const allContent = extractions.flatMap(e =>
    [e.hero?.headline, e.hero?.subheadline, ...e.paragraphs]
  ).filter(Boolean).join(' ').toLowerCase();

  // Problem-indicating patterns
  const problemPatterns = [
    /struggling with/i,
    /tired of/i,
    /frustrated by/i,
    /challenge[sd]? (?:of|with|in)/i,
    /problem[s]? (?:of|with|in|like)/i,
    /pain point/i,
    /(?:do you|are you) (?:having|facing|dealing)/i,
    /(?:hard|difficult|tough) to/i,
    /waste[sd]? (?:time|money|hours)/i,
    /(?:stop|eliminate|end|fix|solve) (?:the|your)/i,
    /what if you could/i,
    /imagine (?:if|a world|being able)/i,
  ];

  const hasProblemFraming = problemPatterns.some(p => p.test(allContent));

  // Solution-only patterns (describing what you do without the why)
  const solutionOnlyPatterns = [
    /we (?:provide|offer|deliver|build|create)/i,
    /(?:our|the) (?:platform|solution|tool|software|product)/i,
    /(?:leading|best|top|premier) (?:provider|solution|platform)/i,
  ];

  const hasSolutionOnly = solutionOnlyPatterns.some(p => p.test(allContent));

  if (!hasProblemFraming && hasSolutionOnly) {
    blockers.push({
      code: 'CLARITY_NO_PROBLEM_FRAMING',
      title: 'Describes solution without the problem',
      description: 'AI expands user queries into problems. Your site only describes what you do, not what problem you solve.',
      pillar: 'clarity',
      severity: 78,
      evidence: [{
        url: homepage?.url || 'Homepage',
        snippet: homepage?.hero?.headline || 'Site content',
        location: 'Homepage and key pages',
      }],
      fixStrategy: 'Lead with the problem your audience faces. "Tired of X? We help you Y." frames context for AI.',
    });
  }

  // Check for question-based framing (good for AI query matching)
  const hasQuestions = /\?/.test(allContent) &&
    /(do you|are you|have you|what if|why do|how do)/i.test(allContent);

  if (!hasQuestions && !hasProblemFraming) {
    blockers.push({
      code: 'CLARITY_NO_QUERY_MATCHING',
      title: 'No question-based framing',
      description: 'AI matches user questions to content. Your site has no questions that mirror how users ask for recommendations.',
      pillar: 'audience',
      severity: 65,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No user-facing questions found',
        location: 'All content',
      }],
      fixStrategy: 'Add FAQ or question-based sections: "Looking for X?" or "Struggling with Y?"',
    });
  }

  return blockers;
}

function checkSpecificity(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];
  const allContent = extractions.flatMap(e =>
    [e.hero?.headline, e.hero?.subheadline, ...e.paragraphs]
  ).filter(Boolean).join(' ');

  const realExamplePatterns = [
    /we (?:helped|worked with)\s+([A-Z][a-zA-Z\s]+?)(?:\s+to|\s+by|,|\.)/g,
    /case study:\s*([^.]+)/gi,
  ];

  let hasRealExamples = false;
  for (const pattern of realExamplePatterns) {
    if (allContent.match(pattern)) {
      hasRealExamples = true;
      break;
    }
  }

  if (!hasRealExamples) {
    blockers.push({
      code: 'SPECIFICITY_NO_EXAMPLES',
      title: 'No concrete examples of your work',
      description: "AI found no specific examples showing what you've done for actual clients",
      pillar: 'specificity',
      severity: 86,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No specific client work examples found',
        location: 'All content',
      }],
      fixStrategy: 'Add specific examples: "We helped [Company X] achieve [result]"',
    });
  }

  const outcomePatterns = [
    /\d+%\s*(?:increase|decrease|reduction|improvement|faster)/gi,
    /(?:saved?|reduced?|increased?)\s*(?:by\s*)?\$?[\d,]+/gi,
  ];

  let hasOutcomes = false;
  for (const pattern of outcomePatterns) {
    if (allContent.match(pattern)) {
      hasOutcomes = true;
      break;
    }
  }

  if (!hasOutcomes) {
    blockers.push({
      code: 'SPECIFICITY_NO_OUTCOMES',
      title: 'No specific outcomes or results mentioned',
      description: 'AI found no concrete numbers showing what results you deliver',
      pillar: 'specificity',
      severity: 78,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No specific metrics found',
        location: 'All content',
      }],
      fixStrategy: 'Add specific outcomes: "Reduced processing time by 40%"',
    });
  }

  return blockers;
}

function checkProofPoints(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];
  const allContent = extractions.flatMap(e =>
    [...e.paragraphs, ...e.headings.map(h => h.text)]
  ).filter(Boolean).join(' ');

  const caseStudyPatterns = [
    /case study[:\s]+/gi,
    /how we helped/gi,
    /success story/gi,
  ];

  let hasCaseStudies = false;
  for (const pattern of caseStudyPatterns) {
    if (allContent.match(pattern)) {
      hasCaseStudies = true;
      break;
    }
  }

  if (!hasCaseStudies) {
    blockers.push({
      code: 'PROOF_NO_CASE_STUDIES',
      title: 'No real case studies found',
      description: "AI couldn't find detailed examples of client work",
      pillar: 'proof',
      severity: 84,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No case studies found',
        location: 'All pages',
      }],
      fixStrategy: 'Add 2-3 case studies showing: the client, the challenge, what you did, and results.',
    });
  }

  const testimonialPatterns = [
    /"[^"]{30,500}"\s*[-–—]\s*[A-Z][a-z]+/g,
  ];

  let hasTestimonials = false;
  for (const pattern of testimonialPatterns) {
    if (allContent.match(pattern)) {
      hasTestimonials = true;
      break;
    }
  }

  if (!hasTestimonials) {
    blockers.push({
      code: 'PROOF_NO_TESTIMONIALS',
      title: 'No client testimonials found',
      description: 'AI found no actual client quotes with attribution',
      pillar: 'proof',
      severity: 75,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No testimonials found',
        location: 'All pages',
      }],
      fixStrategy: 'Add real quotes from clients: "Quote" - Name, Title at Company',
    });
  }

  // Check for third-party authority signals (links to external proof)
  // NOTE: In v2, we should add API calls to G2, Capterra, Reddit to verify actual presence
  const thirdPartyPlatforms = [
    { name: 'G2', patterns: ['g2.com', 'g2crowd'] },
    { name: 'Capterra', patterns: ['capterra.com'] },
    { name: 'TrustPilot', patterns: ['trustpilot.com'] },
    { name: 'Product Hunt', patterns: ['producthunt.com'] },
    { name: 'Reddit', patterns: ['reddit.com', 'r/'] },
    { name: 'GitHub', patterns: ['github.com'] },
    { name: 'TechCrunch', patterns: ['techcrunch.com'] },
    { name: 'Forbes', patterns: ['forbes.com'] },
    { name: 'Gartner', patterns: ['gartner.com'] },
    { name: 'Forrester', patterns: ['forrester.com'] },
  ];

  const mentionedPlatforms: string[] = [];
  for (const platform of thirdPartyPlatforms) {
    if (platform.patterns.some(p => allContent.toLowerCase().includes(p))) {
      mentionedPlatforms.push(platform.name);
    }
  }

  // Check for "as seen on" / "featured in" patterns
  const asSeenOnPatterns = [
    /as (?:seen|featured) (?:on|in)/i,
    /featured (?:by|in)/i,
    /recognized by/i,
    /awarded by/i,
    /rated .* on g2/i,
    /\d+[\+]?\s*reviews? on/i,
  ];

  const hasAsSeenOn = asSeenOnPatterns.some(p => p.test(allContent));

  if (mentionedPlatforms.length === 0 && !hasAsSeenOn) {
    blockers.push({
      code: 'PROOF_NO_THIRD_PARTY',
      title: 'No third-party authority signals',
      description: 'AI prioritizes external validation over self-reported claims. Your site has no references to review platforms, press coverage, or community discussions.',
      pillar: 'proof',
      severity: 72,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No links or mentions of G2, Capterra, press, or community platforms',
        location: 'All pages',
      }],
      fixStrategy: 'Add "As featured in" section, link to your G2/Capterra profiles, or mention press coverage. External proof > self-reported claims.',
    });
  }

  return blockers;
}

function checkAudienceClarity(siteData: SiteData, extractions: Extraction[]): Blocker[] {
  const blockers: Blocker[] = [];
  const allText = extractions.flatMap(e =>
    [...e.paragraphs, e.hero?.headline, e.hero?.subheadline]
  ).filter(Boolean).join(' ').toLowerCase();

  if (siteData.allAudienceStatements.length === 0) {
    blockers.push({
      code: 'AUDIENCE_NOT_SPECIFIC',
      title: 'Target audience is vague',
      description: "AI can't tell who this is for",
      pillar: 'audience',
      severity: 80,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No audience statements found',
        location: 'All content',
      }],
      fixStrategy: 'Be specific: "mid-market SaaS companies", "CTOs at healthcare organizations"',
    });
  }

  const sizeIndicators = ['enterprise', 'mid-market', 'startup', 'small business'];
  const hasSize = sizeIndicators.some(ind => allText.includes(ind));

  if (!hasSize) {
    blockers.push({
      code: 'AUDIENCE_NO_SIZE',
      title: 'Company size not specified',
      description: "AI doesn't know if you serve startups, mid-market, or enterprise",
      pillar: 'audience',
      severity: 65,
      evidence: [{
        url: 'Site-wide',
        snippet: 'No company size indicators found',
        location: 'All content',
      }],
      fixStrategy: 'Specify who you work with: "enterprise organizations" or "seed to Series B startups"',
    });
  }

  return blockers;
}

// ============================================
// SCORING
// ============================================

interface Scores {
  total: number;
  pillars: {
    clarity: number;
    specificity: number;
    proof: number;
    audience: number;
  };
}

interface LlmsTxtAnalysis {
  present: boolean;
  aligned: boolean | null;
  modifier: number;
  notes: string[];
}

function analyzeLlmsTxt(
  llmsTxt: string | null,
  siteData: SiteData,
  understanding: Understanding
): LlmsTxtAnalysis {
  if (!llmsTxt) {
    return { present: false, aligned: null, modifier: 0, notes: ['No llms.txt found (neutral)'] };
  }

  const notes: string[] = ['llms.txt found'];
  let alignmentScore = 0;
  let checks = 0;

  const llmsLower = llmsTxt.toLowerCase();
  const siteName = siteData.homepage?.meta?.title?.toLowerCase() || '';

  // Check 1: Does llms.txt mention the product name?
  if (siteName && llmsLower.includes(siteName.split(' ')[0])) {
    alignmentScore++;
    notes.push('Product name matches');
  }
  checks++;

  // Check 2: Does it align with category?
  const category = understanding.category?.toLowerCase() || '';
  if (category && llmsLower.includes(category.split(' ')[0])) {
    alignmentScore++;
    notes.push('Category aligns');
  }
  checks++;

  // Check 3: Is it concise and structured? (good llms.txt is usually <2000 chars)
  if (llmsTxt.length < 2000 && llmsTxt.includes('#')) {
    alignmentScore++;
    notes.push('Well-structured format');
  } else if (llmsTxt.length > 5000) {
    notes.push('llms.txt may be too verbose');
  }
  checks++;

  // Check 4: Does it avoid marketing fluff?
  const fluffWords = ['revolutionary', 'best-in-class', 'world-class', 'cutting-edge', 'game-changing'];
  const hasFluff = fluffWords.some(w => llmsLower.includes(w));
  if (!hasFluff) {
    alignmentScore++;
    notes.push('No marketing fluff detected');
  } else {
    notes.push('Contains marketing language (reduces trust)');
  }
  checks++;

  const alignmentRatio = alignmentScore / checks;
  const aligned = alignmentRatio >= 0.5;

  // Modifier: +3 to +5 if aligned, -5 if misaligned
  let modifier = 0;
  if (aligned) {
    modifier = Math.round(3 + alignmentRatio * 2); // +3 to +5
    notes.push(`Alignment bonus: +${modifier}%`);
  } else {
    modifier = -5;
    notes.push('Misalignment penalty: -5%');
  }

  return { present: true, aligned, modifier, notes };
}

function calculateScores(blockers: Blocker[], llmsTxtModifier: number = 0): Scores {
  const pillarWeights = {
    clarity: 25,
    specificity: 35,
    proof: 25,
    audience: 15,
  };

  const pillarBlockers = {
    clarity: blockers.filter(b => b.pillar === 'clarity'),
    specificity: blockers.filter(b => b.pillar === 'specificity'),
    proof: blockers.filter(b => b.pillar === 'proof'),
    audience: blockers.filter(b => b.pillar === 'audience'),
  };

  const pillarScores: Record<string, number> = {};

  for (const [pillar, weight] of Object.entries(pillarWeights)) {
    const blockerList = pillarBlockers[pillar as keyof typeof pillarBlockers];
    if (blockerList.length === 0) {
      pillarScores[pillar] = 100;
    } else {
      const totalSeverity = blockerList.reduce((sum, b) => sum + b.severity, 0);
      const avgSeverity = totalSeverity / blockerList.length;
      const penalty = Math.min(avgSeverity * (1 + (blockerList.length - 1) * 0.2), 100);
      pillarScores[pillar] = Math.max(0, Math.round(100 - penalty));
    }
  }

  let totalScore = 0;
  for (const [pillar, weight] of Object.entries(pillarWeights)) {
    totalScore += (pillarScores[pillar] * weight) / 100;
  }

  // Apply llms.txt modifier
  totalScore = Math.max(0, Math.min(100, totalScore + llmsTxtModifier));

  return {
    total: Math.round(totalScore),
    pillars: {
      clarity: pillarScores.clarity,
      specificity: pillarScores.specificity,
      proof: pillarScores.proof,
      audience: pillarScores.audience,
    },
  };
}
