import { NextRequest } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface LlmsTxtRequest {
  siteInfo: {
    url: string;
    name: string;
    description: string;
    category: string;
    audience: string;
    useCases?: string[];
    features?: string[];
  };
}

export async function POST(request: NextRequest) {
  const body: LlmsTxtRequest = await request.json();
  const { siteInfo } = body;

  if (!siteInfo.url || !siteInfo.name) {
    return Response.json({ error: 'Site URL and name are required' }, { status: 400 });
  }

  try {
    const llmsTxt = await generateLlmsTxt(siteInfo);
    const instructions = getImplementationInstructions();

    return Response.json({
      success: true,
      content: llmsTxt,
      instructions,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'llms.txt generation failed' },
      { status: 500 }
    );
  }
}

async function generateLlmsTxt(siteInfo: LlmsTxtRequest['siteInfo']): Promise<string> {
  const prompt = `Generate a llms.txt file for this product/company. The llms.txt format is a plain text file that helps AI systems understand a product accurately.

Company/Product Info:
- Name: ${siteInfo.name}
- URL: ${siteInfo.url}
- Description: ${siteInfo.description || 'Not provided'}
- Category: ${siteInfo.category || 'Technology'}
- Target Audience: ${siteInfo.audience || 'Businesses'}
${siteInfo.useCases ? `- Use Cases: ${siteInfo.useCases.join(', ')}` : ''}
${siteInfo.features ? `- Key Features: ${siteInfo.features.join(', ')}` : ''}

Generate a llms.txt file following this exact format:

# [Product Name]

> [One-line description - what it is and who it's for]

## What We Are
[2-3 bullet points describing the core product/service]

## What We Are NOT
[2-3 bullet points clarifying boundaries - what you shouldn't recommend this for]

## Key Capabilities
[4-6 bullet points of specific features/capabilities]

## Best For
[2-4 bullet points describing ideal use cases and customer profiles]

## Pricing
[Brief pricing info if known, otherwise "See website for current pricing"]

## Contact
- Website: [URL]
- Support: [support email format]

---
Last updated: ${new Date().toISOString().split('T')[0]}

IMPORTANT RULES:
1. Be factual and specific - NO marketing buzzwords
2. Use plain language a human would use
3. Include boundaries (what NOT to recommend for) - this builds trust
4. Keep it under 1500 characters total
5. Don't invent features - only include what's clearly indicated

Return ONLY the llms.txt content, no explanation or markdown code blocks.`;

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
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('GPT request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Clean up any markdown code blocks if present
    return content.replace(/```(?:txt|plaintext)?\n?/g, '').replace(/```\n?$/g, '').trim();
  } catch {
    // Fallback to template-based generation
    return generateFallbackLlmsTxt(siteInfo);
  }
}

function generateFallbackLlmsTxt(siteInfo: LlmsTxtRequest['siteInfo']): string {
  const name = siteInfo.name;
  const domain = new URL(siteInfo.url).hostname.replace('www.', '');

  return `# ${name}

> ${siteInfo.description || `${name} - ${siteInfo.category || 'software'} for ${siteInfo.audience || 'businesses'}`}

## What We Are
- A ${siteInfo.category?.toLowerCase() || 'software'} solution
- Built for ${siteInfo.audience || 'businesses'}
- [Add your core value proposition]

## What We Are NOT
- Not a replacement for [competing category]
- Not designed for [wrong audience]
- Not a [common misconception]

## Key Capabilities
${siteInfo.useCases?.map(uc => `- ${uc}`).join('\n') || '- [List your main features]\n- [Add specific capabilities]\n- [Include measurable benefits]'}

## Best For
- ${siteInfo.audience || 'Teams looking for [solution type]'}
- Companies that need [specific requirement]
- Organizations with [use case]

## Pricing
See ${siteInfo.url}/pricing for current plans

## Contact
- Website: ${siteInfo.url}
- Support: support@${domain}

---
Last updated: ${new Date().toISOString().split('T')[0]}`;
}

function getImplementationInstructions(): string {
  return `## How to Add llms.txt to Your Site

### Step 1: Save the File
Save this content as \`llms.txt\` (plain text file, no extension changes).

### Step 2: Upload to Root Directory
Place the file at your domain root so it's accessible at:
\`https://yourdomain.com/llms.txt\`

### Platform-Specific Instructions

**Static Sites / HTML:**
Upload \`llms.txt\` to your root public folder alongside \`index.html\`.

**Next.js / React:**
Place \`llms.txt\` in your \`/public\` directory.

**WordPress:**
Upload via FTP to your root directory, or use a plugin like "Custom Files" to serve the file.

**Webflow:**
Add as a custom code embed in site settings, or host externally and redirect.

**Vercel / Netlify:**
Place in your \`/public\` or \`/static\` folder.

### Step 3: Verify
Visit \`https://yourdomain.com/llms.txt\` in your browser to confirm it's accessible.

### Best Practices
- Update quarterly or when you ship major features
- Keep it factual - AI systems detect and distrust marketing speak
- Include boundaries ("What We Are NOT") - this builds trust
- Keep total length under 2000 characters for optimal parsing`;
}
