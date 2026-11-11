// Quick verification of review generation logic
const { INDIAN_NAMES_POOL, CATEGORY_REVIEW_TEMPLATES, normalizeCategoryKey, generateCuratedReviews } = require('../src/lib/reviewTemplates.ts');

console.log('Testing category normalization:');
console.log('Carpenter ->', normalizeCategoryKey('Carpenter'));
console.log('Electrician ->', normalizeCategoryKey('Electrician'));
console.log('Plumbing ->', normalizeCategoryKey('Plumbing'));
console.log('Painting ->', normalizeCategoryKey('Painting'));
console.log('Daily Labour ->', normalizeCategoryKey('Daily Labour'));

console.log('\nPool sizes:');
console.log('Indian names pool count:', INDIAN_NAMES_POOL.length);
console.log('Carpentry reviews count:', CATEGORY_REVIEW_TEMPLATES.carpentry.length);
console.log('Electrician reviews count:', CATEGORY_REVIEW_TEMPLATES.electrician.length);
console.log('Plumber reviews count:', CATEGORY_REVIEW_TEMPLATES.plumber.length);
console.log('Painting reviews count:', CATEGORY_REVIEW_TEMPLATES.painting.length);
console.log('General reviews count:', CATEGORY_REVIEW_TEMPLATES.general.length);

const sampleUsedNames = new Set(["Ramesh Hegde", "Sneha Rao"]);
const sampleUsedComments = new Set([CATEGORY_REVIEW_TEMPLATES.carpentry[0].comment]);

const gen = generateCuratedReviews('Carpentry', 5, sampleUsedNames, sampleUsedComments);
console.log('\nGenerated 5 Carpentry reviews:');
gen.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.userName}] (${r.rating} stars, ${r.daysAgo} days ago): "${r.comment}"`);
});

// Check constraints: no "7 hours", no "otp"
const fullText = JSON.stringify(CATEGORY_REVIEW_TEMPLATES);
const has7Hours = /7\s*hours/i.test(fullText);
const hasOtp = /\botp\b/i.test(fullText);
console.log('\nConstraint checks across all templates:');
console.log('Contains "7 hours":', has7Hours);
console.log('Contains "OTP":', hasOtp);
