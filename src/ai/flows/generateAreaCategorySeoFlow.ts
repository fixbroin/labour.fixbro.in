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
You are an advanced Local SEO expert for Fixbro.

Fixbro provides:
- Carpenter services
- Plumbing services
- Electrician services
- TV installation services
- Painting services
- Furniture assembly services
- Interior services
- Home repair services

TARGET:
Area: {{areaName}}
City: {{cityName}}
Category: {{categoryName}}
Trade: {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}}

IMPORTANT SEO RULES:

1. Strongly optimize for:
- carpenter near me
- plumber near me
- electrician near me
- tv installation near me
- painting services near me
- furniture assembly near me

2. NEVER use the word "handyman" (nobody in India searches for handyman; use "home services", specific trade names like carpenter, plumber, electrician, and service names).
Avoid overusing:
- best
- top-rated
- professional

3. Use natural human-friendly SEO.

4. Area + category should appear naturally.

5. Improve Google CTR.

6. Avoid keyword stuffing.

7. Generate ONLY valid JSON.

8. No markdown.

9. Use India local SEO intent.

10. Content should rank for hyper-local searches.

11. Mention important nearby landmarks naturally.

12. Mention local Bangalore areas nearby.

OUTPUT RULES:

1. h1_title
Format:
"{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Services in {{areaName}}"

Examples:
"Carpenter Services in Whitefield"
"Electrician Services in HSR Layout"

2. meta_title
Rules:
- Strictly 35 to 55 characters
- NEVER include brand/company name (e.g. Fixbro, FixBro). The website template automatically appends it.
- Format: "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{areaName}}, {{cityName}} | Near Me" or "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{areaName}} | Near Me"
- Natural, search optimized

Examples:
"Carpenter in Whitefield, Bangalore | Near Me"
"Plumber in HSR Layout, Bangalore | Near Me"
"Electrician in Koramangala | Near Me"

3. meta_description
Rules:
- Strictly under 155 characters
- Mention:
  - "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{areaName}}, {{cityName}} near you"
  - trusted verified experts
  - upfront pricing & same-day doorstep service
  - call to action: "Book online now!"
- NEVER include company name (template appends it).

Example:
"Book trusted carpenter in Whitefield, Bangalore near you. Doorstep furniture repair, assembly & woodwork by verified experts. Upfront rates. Book online now!"

4. meta_keywords
Rules:
- Exactly 10 keywords
- Comma separated
- High search intent only

Example:
carpenter whitefield,
carpenter near me whitefield,
furniture repair whitefield,
wood work whitefield,
bed assembly whitefield,
wardrobe installation whitefield,
door repair whitefield,
furniture assembly whitefield,
electrician near me whitefield,
plumber near me whitefield

5. seo_content
Rules:
- 250 to 350 words
- HTML format only
- Use:
  - <p>
  - <strong>
  - <br>

- Mention:
  - nearby landmarks
  - local areas
  - verified experts
  - same day service
  - affordable pricing
  - customer trust

- Mention area name naturally multiple times.
- Content must feel human written.
- Avoid robotic repetition.

6. faqs
Rules:
- Generate 5 FAQs
- Highly local SEO focused
- Mention area name naturally
- Questions should match real Google searches

7. imageHint: Keywords for finding a relevant high-quality image.

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