'use server';
/**
 * @fileOverview AI flow to generate highly optimized city SEO
 * content for Fixbro city pages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  cleanSeoString,
  truncateSeoString,
  stripBrandSuffix,
} from '@/lib/seoAdvancedUtils';

const GenerateCitySeoInputSchema = z.object({
  cityName: z.string().describe(
    'City name. Example: Bangalore'
  ),
});

export type GenerateCitySeoInput = z.infer<
  typeof GenerateCitySeoInputSchema
>;

const GenerateCitySeoOutputSchema = z.object({
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

export type GenerateCitySeoOutput = z.infer<
  typeof GenerateCitySeoOutputSchema
>;

export async function generateCitySeo(
  input: GenerateCitySeoInput
): Promise<GenerateCitySeoOutput> {
  return generateCitySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCitySeoPrompt',

  input: {
    schema: GenerateCitySeoInputSchema,
  },

  output: {
    schema: GenerateCitySeoOutputSchema,
  },

  prompt: `
You are an advanced Local SEO expert for Fixbro Daily Labour.

Fixbro Daily Labour provides verified daily wage workers for full-day on-site labour:
1. Carpenter daily labour (Top Priority #1)
2. Painting daily labour (Priority #2)
3. Electrician daily labour (Priority #3)
4. Plumbing daily labour
5. Masonry & construction labour
6. Helpers & general daily labour
7. Renovation & interior daily workers

TARGET CITY:
{{cityName}}

IMPORTANT SEO RULES:

1. Focus strongly on high-search keywords:
- daily labour near me
- carpenter daily labour near me
- painter daily labour near me
- electrician daily labour near me
- daily wage workers near me
- hire daily labour in {{cityName}}
- daily labour {{cityName}}

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "daily labour", "daily wage workers", and specific trade names like carpenter, painter, electrician).
Avoid overusing:
- best
- top-rated

3. Use natural human-friendly SEO.

4. City name should appear naturally.

5. Optimize for India local SEO.

6. SEO title should improve CTR.

7. Avoid keyword stuffing.

8. Generate ONLY valid JSON.

9. No markdown.

10. Keywords must be highly searchable in India.

OUTPUT RULES:

1. h1_title
Format:
"Daily Labour in {{cityName}}" or "Carpenter, Painter & Daily Labour in {{cityName}}"

2. seo_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "Daily Labour in {{cityName}} | Near Me" or "Carpenter & Daily Labour in {{cityName}} | Near Me"
- Natural, search optimized

3. seo_description
Rules:
- Strictly under 155 characters
- Mention:
  - "Hire verified daily labour in {{cityName}} near you"
  - verified daily wage trade workers
  - full-day booking & upfront daily rates
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Hire verified daily labour in {{cityName}} near you. Background-checked daily wage workers for full-day work with upfront daily rates. Book online now!"

4. seo_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- Use high search intent keywords

Example:
daily labour {{cityName}},
daily labour near me,
carpenter daily labour {{cityName}},
painter daily labour {{cityName}},
electrician daily labour {{cityName}},
daily wage workers {{cityName}},
hire daily labour {{cityName}},
full day daily labour {{cityName}},
local daily labour {{cityName}},
daily wage carpenter near me

Generate highly optimized city SEO now.
`,
});

const generateCitySeoFlow = ai.defineFlow(
  {
    name: 'generateCitySeoFlow',

    inputSchema: GenerateCitySeoInputSchema,

    outputSchema: GenerateCitySeoOutputSchema,
  },

  async (input) => {
    const { output } = await prompt(input);

    if (!output) {
      throw new Error(
        'AI failed to generate valid city SEO.'
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