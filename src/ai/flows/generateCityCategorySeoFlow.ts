'use server';
/**
 * @fileOverview AI flow to generate highly optimized
 * SEO content for service category city pages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  cleanSeoString,
  truncateSeoString,
  stripBrandSuffix,
  getCategorySearchTerm,
} from '@/lib/seoAdvancedUtils';

const GenerateCityCategorySeoInputSchema =
  z.object({
    cityName: z.string().describe(
      'City name. Example: Bangalore'
    ),

    categoryName: z.string().describe(
      'Service category name. Example: Carpentry'
    ),

    categoryTrade: z.string().optional().describe(
      'Trade / specialist name. Example: Carpenter'
    ),
  });

export type GenerateCityCategorySeoInput =
  z.infer<
    typeof GenerateCityCategorySeoInputSchema
  >;

const GenerateCityCategorySeoOutputSchema =
  z.object({
    h1_title: z.string().describe(
      'SEO optimized H1 title'
    ),

    meta_title: z.string().describe(
      'SEO optimized meta title'
    ),

    meta_description: z.string().describe(
      'SEO optimized meta description'
    ),

    meta_keywords: z.string().describe(
      'Comma separated SEO keywords'
    ),

    seo_content: z.string().describe(
      'Long form SEO HTML content'
    ),

    faqs: z
      .array(
        z.object({
          question: z.string(),

          answer: z.string(),
        })
      )
      .describe(
        'Local SEO FAQs'
      ),
    imageHint: z.string().describe(
      'One or two keywords for an AI image search'
    ),
  });

export type GenerateCityCategorySeoOutput =
  z.infer<
    typeof GenerateCityCategorySeoOutputSchema
  >;

export async function generateCityCategorySeo(
  input: GenerateCityCategorySeoInput
): Promise<GenerateCityCategorySeoOutput> {
  return generateCityCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCityCategorySeoPrompt',

  input: {
    schema:
      GenerateCityCategorySeoInputSchema,
  },

  output: {
    schema:
      GenerateCityCategorySeoOutputSchema,
  },

  prompt: `
You are an advanced Local SEO expert for Fixbro Daily Labour.

Fixbro Daily Labour provides verified daily wage workers for full-day on-site labour:
- Carpenter daily labour
- Painting daily labour
- Electrician daily labour
- Plumbing daily labour
- Masonry & construction labour
- General helpers & site labour
- Furniture & interior daily workers

TARGET:
City: {{cityName}}
Category: {{categoryName}}
Trade: {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}}

IMPORTANT SEO RULES:

1. Strongly optimize for:
- {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour
- {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour near me
- daily wage {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{cityName}}
- hire {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour
- daily labour {{cityName}}

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "daily labour", "daily wage workers", and specific trade names).
Avoid overusing:
- best
- top-rated
- professional

3. Use natural human-friendly SEO.

4. Category + daily labour + city should appear naturally.

5. Improve Google CTR.

6. Avoid keyword stuffing.

7. Generate ONLY valid JSON.

8. No markdown.

9. Use India local SEO intent.

10. SEO content should rank for local daily labour searches.

11. imageHint: One or two keywords for an AI image search.

OUTPUT RULES:

1. h1_title
Format:
"{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Daily Labour in {{cityName}}"

Examples:
"Carpenter Daily Labour in Bangalore"
"Electrician Daily Labour in Bangalore"

2. meta_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Daily Labour in {{cityName}} | Near Me" or "Hire {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{cityName}} | Near Me"
- Natural, search optimized

Examples:
"Carpenter Daily Labour in Bangalore | Near Me"
"Painter Daily Labour in Bangalore | Near Me"
"Electrician Daily Labour in Bangalore | Near Me"

3. meta_description
Rules:
- Strictly under 155 characters
- Mention:
  - "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour in {{cityName}} near you"
  - background-checked daily wage workers
  - full-day booking & upfront rates
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Hire verified carpenter daily labour in Bangalore near you. Background-checked daily wage workers for full-day work with upfront daily rates. Book online now!"

4. meta_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- High search intent only

Example:
carpenter daily labour bangalore,
carpenter daily labour near me,
daily wage carpenter bangalore,
hire carpenter for a day bangalore,
carpenter labour chowk bangalore,
daily labour carpenter near me,
woodwork daily labour bangalore,
furniture daily labour bangalore,
daily labour contractor bangalore,
carpenter daily wage near me

5. seo_content
Rules:
- 200 to 300 words
- HTML format only
- Use:
  - <p>
  - <strong>
  - <br>

- Mention:
  - major {{cityName}} areas
  - full-day working hours (09:30 AM to 05:30 PM with 1-hour lunch break)
  - verified daily wage workers
  - transparent daily pricing with zero hidden commissions
  - Start & Complete OTP verification for customer peace of mind

- Content must feel human written.
- Avoid robotic repetition.

6. faqs
Rules:
- Generate 5 FAQs
- Highly local daily labour SEO focused (working hours, daily wage rates, OTP verification, tools, multiday bookings)
- Mention {{cityName}} naturally
- Questions should match real Google searches

7. imageHint: Keywords for finding a relevant high-quality image (e.g. "carpenter daily labour bangalore").

Generate highly optimized city category SEO now.
`,
});

const generateCityCategorySeoFlow =
  ai.defineFlow(
    {
      name:
        'generateCityCategorySeoFlow',

      inputSchema:
        GenerateCityCategorySeoInputSchema,

      outputSchema:
        GenerateCityCategorySeoOutputSchema,
    },

    async (input) => {
      const categoryTrade = getCategorySearchTerm(input.categoryName);
      const { output } =
        await prompt({
          ...input,
          categoryTrade,
        });

      if (!output) {
        throw new Error(
          'AI failed to generate valid city category SEO.'
        );
      }

      const cleanTitle = stripBrandSuffix(cleanSeoString(output.meta_title));

      return {
        h1_title: cleanSeoString(
          output.h1_title
        ),

        meta_title: truncateSeoString(
          cleanTitle,
          55
        ),

        meta_description:
          truncateSeoString(
            cleanSeoString(
              output.meta_description
            ),
            155
          ),

        meta_keywords:
          cleanSeoString(
            output.meta_keywords
          ),

        seo_content:
          output.seo_content,

        faqs: output.faqs,
        imageHint: output.imageHint,
      };
    }
  );