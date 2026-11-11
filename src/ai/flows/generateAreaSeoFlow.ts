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
You are an advanced Local SEO expert for Fixbro Daily Labour.

Fixbro Daily Labour provides verified daily wage workers for full-day on-site labour:
1. Carpenter daily labour (Top Priority #1)
2. Painting daily labour (Priority #2)
3. Electrician daily labour (Priority #3)
4. Plumbing daily labour
5. Masonry & construction labour
6. Helpers & general daily labour
7. Renovation & interior daily workers

TARGET LOCATION:
Area: {{areaName}}
City: {{cityName}}

IMPORTANT SEO RULES:

1. Focus strongly on high-search keywords:
- daily labour near me
- carpenter daily labour near me
- painter daily labour near me
- electrician daily labour near me
- daily wage workers in {{areaName}}
- hire daily labour in {{areaName}}
- daily labour {{areaName}}

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "daily labour", "daily wage workers", and specific trade names like carpenter, painter, electrician).
Avoid overusing:
- best
- top-rated

3. Use natural human-friendly SEO.

4. Area name should appear naturally.

5. Optimize for local SEO in {{cityName}}.

6. SEO title should improve CTR.

7. Avoid keyword stuffing.

8. Generate ONLY valid JSON.

9. No markdown.

10. Keywords must be highly searchable in India.

OUTPUT RULES:

1. h1_title
Format:
"Daily Labour in {{areaName}}" or "Carpenter, Painter & Daily Labour in {{areaName}}"

2. seo_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "Daily Labour in {{areaName}}, {{cityName}} | Near Me" or "Daily Labour in {{areaName}} | Near Me"
- Natural, search optimized

3. seo_description
Rules:
- Strictly under 155 characters
- Mention:
  - "Hire verified daily labour in {{areaName}}, {{cityName}} near you"
  - background-checked daily wage workers
  - full-day work with upfront daily rates
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Hire verified daily labour in {{areaName}}, {{cityName}} near you. Background-checked daily wage workers for full-day work with upfront daily rates. Book online now!"

4. seo_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- Use high search intent keywords

Example:
daily labour {{areaName}},
daily labour near me {{areaName}},
carpenter daily labour {{areaName}},
painter daily labour {{areaName}},
electrician daily labour {{areaName}},
daily wage workers {{areaName}},
hire daily labour {{areaName}},
full day labour {{areaName}},
local daily labour {{areaName}},
daily wage carpenter {{areaName}}

Generate highly optimized area SEO now.
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