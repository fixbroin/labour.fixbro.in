'use server';
/**
 * @fileOverview AI flow to generate highly optimized local SEO
 * content for Bangalore area/location pages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  cleanSeoString,
  truncateSeoString,
  stripBrandSuffix,
} from '@/lib/seoAdvancedUtils';

const GenerateAreaSeoInputSchema = z.object({
  areaName: z.string().describe(
    'Area or locality name. Example: Whitefield'
  ),

  cityName: z.string().describe(
    'City name. Example: Bangalore'
  ),
});

export type GenerateAreaSeoInput = z.infer<
  typeof GenerateAreaSeoInputSchema
>;

const GenerateAreaSeoOutputSchema = z.object({
  h1_title: z.string().describe(
    'SEO optimized H1 title'
  ),

  seo_title: z.string().describe(
    'SEO optimized meta title'
  ),

  seo_description: z.string().describe(
    'SEO optimized meta description'
  ),

  seo_keywords: z.string().describe(
    'Comma separated SEO keywords'
  ),
});

export type GenerateAreaSeoOutput = z.infer<
  typeof GenerateAreaSeoOutputSchema
>;

export async function generateAreaSeo(
  input: GenerateAreaSeoInput
): Promise<GenerateAreaSeoOutput> {
  return generateAreaSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAreaSeoPrompt',

  input: {
    schema: GenerateAreaSeoInputSchema,
  },

  output: {
    schema: GenerateAreaSeoOutputSchema,
  },

  prompt: `
You are an advanced Local SEO expert for Fixbro.

Fixbro provides (strictly prioritize in this order):
1. Carpenter services (Top Priority #1)
2. TV installation services (Priority #2)
3. Interior services (Priority #3)
4. Electrician services
5. Plumbing services
6. Painting services
7. Furniture assembly services
8. Home repair services

TARGET LOCATION:
Area: {{areaName}}
City: {{cityName}}

IMPORTANT SEO RULES:

1. Focus strongly on high-search keywords:
- carpenter near me
- tv installation near me
- interior designers near me
- electrician near me
- plumber near me
- painting services near me
- furniture assembly near me

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "home services", specific category names like carpenter, tv installation, interior, and "near me" keywords).
Avoid overusing:
- best
- top-rated

3. Use natural human-friendly SEO.

4. Area name should appear naturally.

5. Optimize for Bangalore local SEO.

6. SEO title should improve CTR.

7. Avoid keyword stuffing.

8. Generate ONLY valid JSON.

9. No markdown.

10. Keywords must be highly searchable in India.

OUTPUT RULES:

1. h1_title
Format:
"Carpenter, TV Installation & Home Services in {{areaName}}"

2. seo_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "Home Services in {{areaName}}, {{cityName}} | Near Me" or "Carpenter, TV Installation in {{areaName}} | Near Me"
- Natural, search optimized

3. seo_description
Rules:
- Strictly under 155 characters
- Mention:
  - "Home services in {{areaName}}, {{cityName}} near you"
  - trusted verified experts
  - carpenter, TV installation & interior
  - upfront pricing & same-day visit
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Book trusted home services in Whitefield, Bangalore near you. Verified carpenter, TV installation & interior doorstep visit with upfront rates. Book online now!"

4. seo_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- Use high search intent keywords

Example:
carpenter whitefield,
carpenter near me whitefield,
tv installation whitefield,
tv installation near me whitefield,
interior designers whitefield,
electrician whitefield,
plumber whitefield,
furniture assembly whitefield,
painting services whitefield,
home services near me whitefield

Generate highly optimized local SEO now.
`,
});

const generateAreaSeoFlow = ai.defineFlow(
  {
    name: 'generateAreaSeoFlow',

    inputSchema: GenerateAreaSeoInputSchema,

    outputSchema: GenerateAreaSeoOutputSchema,
  },

  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      throw new Error(
        'AI failed to generate valid area SEO.'
      );
    }

    const cleanTitle = stripBrandSuffix(cleanSeoString(output.seo_title));

    return {
      h1_title: cleanSeoString(
        output.h1_title
      ),

      seo_title: truncateSeoString(
        cleanTitle,
        55
      ),

      seo_description: truncateSeoString(
        cleanSeoString(output.seo_description),
        155
      ),

      seo_keywords: cleanSeoString(
        output.seo_keywords
      ),
    };
  }
);