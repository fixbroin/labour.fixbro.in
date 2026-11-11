'use server';
/**
 * @fileOverview AI flow to generate highly optimized
 * hyper-local SEO content for area category pages.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  cleanSeoString,
  truncateSeoString,
  stripBrandSuffix,
  getCategorySearchTerm,
} from '@/lib/seoAdvancedUtils';

const GenerateAreaCategorySeoInputSchema =
  z.object({
    areaName: z.string().describe(
      'Area name. Example: Whitefield'
    ),

    cityName: z.string().describe(
      'City name. Example: Bangalore'
    ),

    categoryName: z.string().describe(
      'Category name. Example: Carpentry'
    ),

    categoryTrade: z.string().optional().describe(
      'Specialist trade name. Example: Carpenter'
    ),
  });

export type GenerateAreaCategorySeoInput =
  z.infer<
    typeof GenerateAreaCategorySeoInputSchema
  >;

const GenerateAreaCategorySeoOutputSchema =
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
        'Hyper local SEO FAQs'
      ),
    imageHint: z.string().describe(
      'One or two keywords for an AI image search'
    ),
  });

export type GenerateAreaCategorySeoOutput =
  z.infer<
    typeof GenerateAreaCategorySeoOutputSchema
  >;

export async function generateAreaCategorySeo(
  input: GenerateAreaCategorySeoInput
): Promise<GenerateAreaCategorySeoOutput> {
  return generateAreaCategorySeoFlow(
    input
  );
}

const prompt = ai.definePrompt({
  name:
    'generateAreaCategorySeoPrompt',

  input: {
    schema:
      GenerateAreaCategorySeoInputSchema,
  },

  output: {
    schema:
      GenerateAreaCategorySeoOutputSchema,
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
Area: {{areaName}}
City: {{cityName}}
Category: {{categoryName}}
Trade: {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}}

IMPORTANT SEO RULES:

1. Strongly optimize for:
- {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour in {{areaName}}
- {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour near me
- daily wage {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{areaName}}
- hire {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour {{areaName}}
- daily labour {{areaName}}

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "daily labour", "daily wage workers", and specific trade names).
Avoid overusing:
- best
- top-rated
- professional

3. Use natural human-friendly SEO.

4. Area + category + daily labour should appear naturally.

5. Improve Google CTR.

6. Avoid keyword stuffing.

7. Generate ONLY valid JSON.

8. No markdown.

9. Use India local SEO intent.

10. Content should rank for hyper-local daily labour searches.

11. Mention important nearby landmarks naturally.

12. Mention local areas nearby.

OUTPUT RULES:

1. h1_title
Format:
"{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Daily Labour in {{areaName}}"

Examples:
"Carpenter Daily Labour in Whitefield"
"Electrician Daily Labour in HSR Layout"

2. meta_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Daily Labour in {{areaName}}, {{cityName}} | Near Me" or "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Daily Labour in {{areaName}} | Near Me"
- Natural, search optimized

Examples:
"Carpenter Daily Labour in Whitefield | Near Me"
"Painter Daily Labour in HSR Layout | Near Me"
"Electrician Daily Labour in Koramangala | Near Me"

3. meta_description
Rules:
- Strictly under 155 characters
- Mention:
  - "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} daily labour in {{areaName}}, {{cityName}} near you"
  - background-checked daily wage workers
  - full-day work with upfront daily rates
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Hire verified carpenter daily labour in Whitefield, Bangalore near you. Background-checked daily wage workers for full-day work with upfront rates. Book now!"

4. meta_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- High search intent only

Example:
carpenter daily labour {{areaName}},
carpenter daily labour near me,
daily wage carpenter {{areaName}},
hire carpenter for a day {{areaName}},
carpenter labour in {{areaName}},
daily labour carpenter near me,
woodwork daily labour {{areaName}},
furniture daily labour {{areaName}},
daily labour contractor {{areaName}},
carpenter daily wage {{areaName}}

5. seo_content
Rules:
- 250 to 350 words
- HTML format only
- Use:
  - <p>
  - <strong>
  - <br>

- Mention:
  - nearby landmarks in {{areaName}}
  - local areas nearby
  - full-day working hours (09:30 AM to 05:30 PM with 1-hour lunch break)
  - verified daily wage workers
  - transparent daily pricing with zero hidden commission
  - Start & Complete OTP verification for customer security

- Mention area name naturally multiple times.
- Content must feel human written.
- Avoid robotic repetition.

6. faqs
Rules:
- Generate 5 FAQs
- Highly local daily labour SEO focused (working hours, daily wage rates, OTP verification, multiday bookings, tools)
- Mention area name naturally
- Questions should match real Google searches

7. imageHint: Keywords for finding a relevant high-quality image (e.g. "carpenter daily labour {{areaName}}").

Generate highly optimized hyper-local SEO now.
`,
});

const generateAreaCategorySeoFlow =
  ai.defineFlow(
    {
      name:
        'generateAreaCategorySeoFlow',

      inputSchema:
        GenerateAreaCategorySeoInputSchema,

      outputSchema:
        GenerateAreaCategorySeoOutputSchema,
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
          'AI failed to generate valid area category SEO.'
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