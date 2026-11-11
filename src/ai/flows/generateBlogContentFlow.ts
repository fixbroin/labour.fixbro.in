'use server';
/**
 * @fileOverview An AI flow to generate comprehensive daily labour blog content and SEO metadata in HTML format.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { cleanSeoString, truncateSeoString, stripBrandSuffix } from '@/lib/seoAdvancedUtils';

const GenerateBlogContentInputSchema = z.object({
  title: z.string().describe("The title of the daily labour blog post to generate content for."),
  categoryName: z.string().optional().describe("The optional trade category (e.g., Carpenter, Electrician, Painter, Plumber, Mason, Construction Helper)."),
  currentYear: z.string().optional().describe("The current year for dynamic content generation."),
});
export type GenerateBlogContentInput = z.infer<typeof GenerateBlogContentInputSchema>;

const GenerateBlogContentOutputSchema = z.object({
  content: z.string().describe(
    "Complete SEO blog in HTML format. Minimum 1000-1500 words. Use h2, p, ul, li and br tags. Follow daily labour blog structure with large spacing between sections, homeowner/contractor-focused advice, daily wage benchmarks, full-day shift expectations (09:30 AM - 05:30 PM), tools/materials checklist, safety/OTP verification, and CTA."
  ),
  excerpt: z.string().describe("A short, catchy summary of the blog post (max 150 characters) to be used on the blog list card."),
  tags: z.string().describe("Comma-separated string of 5-8 highly relevant daily labour SEO tags."),
  readingTime: z.string().describe("Estimated reading time, e.g., '5 min' or '8 min'."),
  h1_title: z.string().describe("An H1 title for the daily labour blog page."),
  meta_title: z.string().describe("Meta title strictly 35-48 characters. NEVER include company name (template appends it)."),
  meta_description: z.string().describe("Meta description under 155 characters."),
  meta_keywords: z.string().describe("A comma-separated string of daily labour SEO keywords."),
  imageHint: z.string()
    .max(50)
    .describe("AI image hint describing realistic skilled daily labourer at work. Maximum 50 characters only."),
});
export type GenerateBlogContentOutput = z.infer<typeof GenerateBlogContentOutputSchema>;

export async function generateBlogContent(input: Omit<GenerateBlogContentInput, 'currentYear'>): Promise<GenerateBlogContentOutput> {
  const currentYear = new Date().getFullYear().toString();
  return generateBlogContentFlow({ ...input, currentYear });
}

const prompt = ai.definePrompt({
  name: 'generateDailyLabourBlogPrompt',
  input: { schema: GenerateBlogContentInputSchema },
  output: { schema: GenerateBlogContentOutputSchema },
  prompt: `
You are the senior SEO content strategist and daily wage trades expert for Fixbro Daily Labour (Bangalore's leading platform for hiring verified daily labour and skilled trade workers).

Generate an in-depth, authoritative, and practical blog article based on:

Title: {{title}}
Category / Trade: {{categoryName}}
Year: {{currentYear}}

CORE FIXBRO DAILY LABOUR MODEL & POLICIES:
- Full-Day Dedicated Labour Shift: Standard shift is 09:30 AM to 05:30 PM (7 active working hours + 1-hour lunch break from 1:00 PM to 2:00 PM).
- Fixed Transparent Daily Wages: Customers pay a transparent full-day wage rather than unpredictable hourly surge pricing or contractor commissions.
- Skilled Trades & General Labour: Covers carpenters, electricians, plumbers, painters, masonry/tile workers, welders, and construction helpers.
- Tools & Materials: Workers carry their standard professional hand/power tools; customers/contractors provide project materials, paint, cement, or fixtures.
- Safety & Verification: Every daily labourer undergoes thorough government ID check and background verification.
- Two-Factor OTP Sign-in / Sign-out: A secure Start OTP is verified when the worker arrives at 09:30 AM, and a Completion OTP is signed off at 05:30 PM upon full work completion.
- Local Bangalore Focus: Naturally weave in Bangalore localities such as Whitefield, Electronic City, HSR Layout, Sarjapur Road, Koramangala, Bellandur, Marathahalli, Indiranagar, Jayanagar, BTM Layout, JP Nagar, Hebbal, and Yelahanka.

WRITING GUIDELINES:
- Write naturally with practical, real-world advice for homeowners, apartment managers, interior remodelers, and construction supervisors.
- Never sound generic or AI-generated. Avoid buzzwords and keyword stuffing.
- Use realistic daily wage benchmarks, time-management tips, and project estimations.

HTML FORMAT (Strict rules):
Use ONLY clean HTML without markdown backticks.
Section headings:
<h2><strong>Section Title</strong></h2>

Paragraphs:
<p>Text content...</p>

Add spacing between major sections:
<br><br>

Key Highlights & Advantages:
<p><strong>✔ Feature:</strong> Detailed practical explanation.</p>

Lists:
<ul>
  <li>✔ Item detail</li>
</ul>

BLOG OUTLINE & STRUCTURE:
1. Introduction:
   - Overview of the task, why hiring a full-day daily wage worker is more practical and cost-effective than hourly repair services.
   - Common homeowner and renovation scenarios requiring dedicated daily labour.

2. Full-Day Labour vs. Hourly Services (Cost & Productivity Value):
   - Clear value breakdown: getting 7 full hours of dedicated trade work done in a single day.
   - Provide 5 distinct bulleted advantages.

3. Scope of Work a Worker Can Accomplish in One Day (09:30 AM – 05:30 PM):
   - Detailed breakdown of realistic trade tasks (e.g. framing, wiring, drywall patching, tile repairs, fixture installation) achievable in a full shift.

4. Customer Checklist: Materials & Preparation Before Worker Arrival:
   - What the client should purchase or prep before 09:30 AM so work starts smoothly without idle delays.

5. Shift Schedule & Verified OTP Attendance:
   - Punctual 09:30 AM start with customer Start OTP verification.
   - 1:00 PM – 2:00 PM lunch break.
   - 05:30 PM wrap-up and Completion OTP sign-off.

6. Daily Wage Pricing & Rates in Bangalore:
   - Realistic market rate insights for experienced daily labour in Bangalore without contractor middlemen cuts.

7. Safety, ID Verification & Accountability:
   - Importance of government ID verified workers and direct accountability.

8. Bangalore Localities & Same-Day Service Availability:
   - Mention top serviced residential & tech hubs across East, South, North, and Central Bangalore.

9. Why Choose Fixbro Daily Labour:
   - Highlight background checks, zero hidden commission, guaranteed 7 hours of active work, fixed daily rates, and secure OTP verification.

10. How to Book Your Verified Daily Labourer:
    - Clear step-by-step guidance to book on Fixbro Daily Labour.

11. Related Daily Labour Trades & Keywords:
    - Single paragraph mentioning related daily labour searches naturally (e.g., carpenter daily labour, painter daily labour near me, electrician daily wage worker).

SEO REQUIREMENTS:
- Minimum 1200 words (target 1200-1800 words).
- meta_title: STRICTLY 35 to 48 characters. NEVER append brand suffix (template appends " | Fixbro Daily Labour").
- meta_description: Under 155 characters. Punchy, action-driven summary for daily labour hiring.
- excerpt: Under 150 characters for blog cards.
- tags: 5-8 relevant tags like "Carpenter Daily Labour, Daily Wage Workers, Bangalore Daily Labour, Full Day Trade Labour".
- imageHint: Maximum 50 characters describing a realistic skilled worker at work.

Return valid JSON matching the schema.
`,
});

const generateBlogContentFlow = ai.defineFlow(
  {
    name: 'generateDailyLabourBlogFlow',
    inputSchema: GenerateBlogContentInputSchema,
    outputSchema: GenerateBlogContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid daily labour blog post response.");
    }

    const cleanTitle = stripBrandSuffix(cleanSeoString(output.meta_title));

    return {
      ...output,
      h1_title: cleanSeoString(output.h1_title),
      meta_title: truncateSeoString(cleanTitle, 48),
      meta_description: truncateSeoString(cleanSeoString(output.meta_description), 155),
      excerpt: truncateSeoString(cleanSeoString(output.excerpt), 150),
    };
  }
);
