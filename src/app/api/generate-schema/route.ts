import { NextRequest } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface SchemaRequest {
  schemaType: 'organization' | 'product' | 'faq' | 'review' | 'all';
  siteInfo: {
    url: string;
    name: string;
    description: string;
    category: string;
    audience: string;
    faqs?: Array<{ question: string; answer: string }>;
    testimonials?: string[];
  };
}

export async function POST(request: NextRequest) {
  const body: SchemaRequest = await request.json();
  const { schemaType, siteInfo } = body;

  if (!siteInfo.url || !siteInfo.name) {
    return Response.json({ error: 'Site URL and name are required' }, { status: 400 });
  }

  try {
    const schemas: Record<string, object> = {};

    // Generate Organization schema
    if (schemaType === 'organization' || schemaType === 'all') {
      schemas.organization = await generateOrganizationSchema(siteInfo);
    }

    // Generate Product/SoftwareApplication schema
    if (schemaType === 'product' || schemaType === 'all') {
      schemas.product = await generateProductSchema(siteInfo);
    }

    // Generate FAQPage schema
    if (schemaType === 'faq' || schemaType === 'all') {
      if (siteInfo.faqs && siteInfo.faqs.length > 0) {
        schemas.faq = generateFAQSchema(siteInfo.faqs);
      }
    }

    // Generate Review schema
    if (schemaType === 'review' || schemaType === 'all') {
      if (siteInfo.testimonials && siteInfo.testimonials.length > 0) {
        schemas.review = await generateReviewSchema(siteInfo);
      }
    }

    // Format as ready-to-use HTML
    const htmlSnippets: string[] = [];
    for (const [type, schema] of Object.entries(schemas)) {
      htmlSnippets.push(
        `<!-- ${type.charAt(0).toUpperCase() + type.slice(1)} Schema -->\n<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
      );
    }

    return Response.json({
      success: true,
      schemas,
      html: htmlSnippets.join('\n\n'),
      instructions: getImplementationInstructions(schemaType),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Schema generation failed' },
      { status: 500 }
    );
  }
}

async function generateOrganizationSchema(siteInfo: SchemaRequest['siteInfo']): Promise<object> {
  // Use GPT to enrich the schema with better descriptions
  const prompt = `Generate a JSON-LD Organization schema for this company. Return ONLY valid JSON, no markdown.

Company Info:
- Name: ${siteInfo.name}
- URL: ${siteInfo.url}
- Description: ${siteInfo.description || 'Not provided'}
- Category: ${siteInfo.category || 'Technology'}
- Target Audience: ${siteInfo.audience || 'Businesses'}

Generate a complete Organization schema with:
- @context and @type
- name, url, description
- A professional sameAs array (leave empty if unsure)
- contactPoint with generic support email format

Return ONLY the JSON object, no explanation.`;

  try {
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
      throw new Error('GPT request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback to basic schema
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteInfo.name,
      url: siteInfo.url,
      description: siteInfo.description || `${siteInfo.name} - ${siteInfo.category || 'Technology'} solutions`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: `support@${new URL(siteInfo.url).hostname.replace('www.', '')}`,
      },
    };
  }
}

async function generateProductSchema(siteInfo: SchemaRequest['siteInfo']): Promise<object> {
  const prompt = `Generate a JSON-LD SoftwareApplication schema for this product. Return ONLY valid JSON, no markdown.

Product Info:
- Name: ${siteInfo.name}
- URL: ${siteInfo.url}
- Description: ${siteInfo.description || 'Not provided'}
- Category: ${siteInfo.category || 'Business Software'}
- Target Audience: ${siteInfo.audience || 'Businesses'}

Generate a SoftwareApplication schema with:
- @context and @type
- name, url, description
- applicationCategory
- operatingSystem: "Web"
- offers with a FreeTrial or typical SaaS pricing structure

Return ONLY the JSON object, no explanation.`;

  try {
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
      throw new Error('GPT request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteInfo.name,
      url: siteInfo.url,
      description: siteInfo.description || `${siteInfo.name} software`,
      applicationCategory: siteInfo.category || 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free trial available',
      },
    };
  }
}

function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.slice(0, 10).map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

async function generateReviewSchema(siteInfo: SchemaRequest['siteInfo']): Promise<object> {
  const testimonials = siteInfo.testimonials || [];

  // Create aggregate rating based on testimonial count
  const ratingValue = Math.min(4.5 + (testimonials.length * 0.1), 5);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: siteInfo.name,
    description: siteInfo.description,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toFixed(1),
      reviewCount: Math.max(testimonials.length, 1),
      bestRating: '5',
      worstRating: '1',
    },
    review: testimonials.slice(0, 5).map((testimonial, i) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: '5',
        bestRating: '5',
      },
      reviewBody: testimonial,
      author: {
        '@type': 'Person',
        name: `Customer ${i + 1}`, // Placeholder - they should replace with real names
      },
    })),
  };
}

function getImplementationInstructions(schemaType: string): string {
  return `## How to Add Schema to Your Site

### Option 1: Add to HTML <head> (Recommended)
Copy the schema code above and paste it into your website's <head> section, just before the closing </head> tag.

### Option 2: WordPress
1. Install a plugin like "Schema Pro" or "Rank Math"
2. Or add to your theme's header.php file
3. Or use a "Header Scripts" plugin

### Option 3: Next.js / React
Add to your layout.tsx or _document.tsx:
\`\`\`tsx
<Head>
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
  />
</Head>
\`\`\`

### Option 4: Webflow / Squarespace
Look for "Custom Code" in your site settings and paste in the <head> section.

### Verification
After adding, use Google's Rich Results Test to verify:
https://search.google.com/test/rich-results

${schemaType === 'review' ? '\n⚠️ Note: For Review schema, replace "Customer 1", "Customer 2" etc. with real customer names for authenticity.' : ''}
${schemaType === 'faq' ? '\n💡 Tip: FAQPage schema can appear as rich results in Google search, increasing click-through rates.' : ''}
`;
}
