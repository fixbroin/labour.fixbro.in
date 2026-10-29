'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a service category.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString, stripBrandSuffix, getCategorySearchTerm } from '@/lib/seoAdvancedUtils';

const GenerateCategorySeoInputSchema = z.object({
  categoryName: z.string().describe("The name of the service category, e.g., 'Carpentry' or 'Appliance Repair'."),
  categoryTrade: z.string().optional().describe("Trade / specialist name, e.g., 'Carpenter' or 'Appliance Repair Technician'."),
  cityName: z.string().optional().describe("Target city name, e.g., 'Bangalore'. Defaults to 'Bangalore' if omitted."),
});
export type GenerateCategorySeoInput = z.infer<typeof GenerateCategorySeoInputSchema>;

const GenerateCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the category page."),
  seo_title: z.string().describe("Meta title strictly 35-55 characters. NEVER include company name (template appends it). Use '{{categoryTrade}} in {{cityName}} | Near Me'."),
  seo_description: z.string().describe("Meta description strictly under 155 characters featuring '{{categoryTrade}} in {{cityName}} near you', verified pros, upfront pricing, and 'Book online now!'."),
  seo_keywords: z.string().describe("10 comma-separated localized SEO keywords."),
  seo_content: z.string().describe("A 200-280 word professional HTML bio for the category with local relevance."),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).describe("3-5 high-intent FAQs about the service category."),
  imageHint: z.string().describe("One or two keywords for an image search."),
});
export type GenerateCategorySeoOutput = z.infer<typeof GenerateCategorySeoOutputSchema>;

export async function generateCategorySeo(input: GenerateCategorySeoInput): Promise<GenerateCategorySeoOutput> {
  return generateCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCategorySeoPrompt',
  input: { schema: GenerateCategorySeoInputSchema },
  output: { schema: GenerateCategorySeoOutputSchema },
  prompt: `Local SEO Copywriter for Home Services.
Generate high-conversion SEO content for category page.

Category: {{categoryName}}
Trade: {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}}
City: {{#if cityName}}{{cityName}}{{else}}Bangalore{{/if}}

CRITICAL SEO RULES:
1. NEVER include brand/company names (e.g. "Fixbro", "FixBro") in seo_title. The website template automatically appends it.
2. seo_title MUST be strictly between 35 and 55 characters. Use trade noun. Format: "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{#if cityName}}{{cityName}}{{else}}Bangalore{{/if}} | {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} Near Me" (or "{{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{#if cityName}}{{cityName}}{{else}}Bangalore{{/if}} | Near Me").
3. seo_description MUST be under 155 characters: "Book trusted {{#if categoryTrade}}{{categoryTrade}}{{else}}{{categoryName}}{{/if}} in {{#if cityName}}{{cityName}}{{else}}Bangalore{{/if}} near you. Doorstep service by verified experts, upfront pricing & same-day visit. Book online now!".
4. seo_keywords MUST be 10 high-search phrases mixing category/trade + city and "near me".
5. faqs MUST be 3-5 real customer questions regarding pricing, warranty, and same-day service.

Return ONLY valid JSON.`,
});

const generateCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateCategorySeoFlow',
    inputSchema: GenerateCategorySeoInputSchema,
    outputSchema: GenerateCategorySeoOutputSchema,
  },
  async (input) => {
    const cityName = input.cityName || 'Bangalore';
    const categoryTrade = getCategorySearchTerm(input.categoryName);
    const { output } = await prompt({ ...input, categoryTrade, cityName });
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the category.");
    }

    const cleanTitle = stripBrandSuffix(cleanSeoString(output.seo_title));
    
    return {
      h1_title: cleanSeoString(output.h1_title),
      seo_title: truncateSeoString(cleanTitle, 55),
      seo_description: truncateSeoString(cleanSeoString(output.seo_description), 155),
      seo_keywords: cleanSeoString(output.seo_keywords),
      seo_content: output.seo_content,
      faqs: output.faqs,
      imageHint: output.imageHint,
    };
  }
);
