/**
 * One-time seed: inserts the site's current hardcoded FAQ/testimonial copy
 * (from client/src/pages/public/HomePage.jsx and FAQsPage.jsx) as the initial
 * Faq/Testimonial rows, so switching those pages to fetch from the API is
 * visually seamless — the public site looks identical on day one, then
 * becomes admin-editable going forward.
 *
 * Upsert-style (matched by question/quote text) so it's safe to re-run.
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Faq = require("../models/Faq");
const Testimonial = require("../models/Testimonial");

const HOMEPAGE_FAQS = [
  { question: 'How does the matching process work?', answer: 'After submitting your request, our team reviews your requirements and identifies suitable nannies from our curated network. We then introduce you to candidates we believe are a strong match for your family.' },
  { question: 'Do I need to create an account to make an enquiry?', answer: 'No. You can submit a childcare request or nanny application without creating an account.' },
  { question: 'What areas of London do you cover?', answer: 'We work across Greater London. Please include your postcode or area in your enquiry and we will confirm coverage.' },
  { question: 'How quickly can a nanny be placed?', answer: 'Timescales vary by service and availability. Emergency placements are prioritised. We will give you a realistic expectation during your consultation.' },
];

const GENERAL_FAQS = [
  { question: 'What areas of London do you cover?', answer: 'We cover all London boroughs, including Central, North, South, East, and West London. We can also accommodate requests just outside Greater London on a case-by-case basis.' },
  { question: 'How does the vetting process work?', answer: 'Our vetting is rigorous. Every nanny must have an enhanced DBS check, Paediatric First Aid, right to work in the UK, and at least two verified professional references. We also conduct thorough in-person or video interviews.' },
  { question: 'What are your office hours?', answer: 'Our standard office hours are Monday to Friday, 8am to 6pm. However, we monitor emergency requests outside of these hours to provide support when you need it most.' },
];

const FAMILIES_FAQS = [
  { question: 'How quickly can you find a nanny for us?', answer: 'For emergency cover, we can often place a nanny within hours. For permanent roles, the process typically takes 2-4 weeks to ensure we find the perfect match through careful curation and interviews.' },
  { question: 'Do we have to pay a registration fee?', answer: 'No, we do not charge an upfront registration fee to begin the search. You only pay our placement fee once you have successfully hired a nanny through us.' },
  { question: "What happens if the nanny isn't the right fit?", answer: 'We offer a replacement guarantee period (typically 4 to 8 weeks, depending on the contract). If the placement does not work out during this time, we will find a suitable replacement free of charge.' },
  { question: 'Do you help with contracts and payroll?', answer: 'Yes. We provide standard employment contract templates and can recommend trusted specialist payroll providers to ensure you are fully compliant with UK employment law.' },
];

const NANNIES_FAQS = [
  { question: 'Do I have to pay to register with Marvza?', answer: 'Absolutely not. We never charge nannies a fee to register, interview, or be placed with a family.' },
  { question: 'Do I need formal childcare qualifications?', answer: 'While formal qualifications (like CACHE or Norland) are highly valued, they are not strictly required if you have significant, verifiable professional experience (usually 2+ years) working as a nanny.' },
  { question: 'Will I be employed by Marvza or the family?', answer: 'For permanent and most temporary roles, you will be directly employed by the family. For certain ad-hoc or event roles, different arrangements may apply, which will always be discussed upfront.' },
];

const TESTIMONIALS = [
  { quote: "Our nanny has been an absolute blessing for our family. The agency matched us perfectly with someone who truly understands our children's needs — we couldn't be happier.", name: 'The Harrington Family', location: 'South West London', service: 'Full-Time Nanny', rating: 5 },
  { quote: "Finding reliable backup care in London felt impossible until we found Marvza. Seamless, professional and genuinely caring. They've never let us down.", name: 'The Chen Family', location: 'North London', service: 'Backup Nanny', rating: 5 },
  { quote: 'The emergency nanny service saved us on more than one occasion. Within hours we had a wonderful, qualified nanny at our door. Highly recommend to any London family.', name: 'The Okonkwo Family', location: 'Central London', service: 'Emergency Nanny', rating: 5 },
];

async function seedFaqCategory(items, category) {
  for (let i = 0; i < items.length; i++) {
    await Faq.findOneAndUpdate(
      { question: items[i].question, category },
      { ...items[i], category, order: i, isPublished: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

async function main() {
  await connectDB();

  await seedFaqCategory(HOMEPAGE_FAQS, "homepage");
  await seedFaqCategory(GENERAL_FAQS, "general");
  await seedFaqCategory(FAMILIES_FAQS, "families");
  await seedFaqCategory(NANNIES_FAQS, "nannies");
  console.log(`[Seed] Upserted ${HOMEPAGE_FAQS.length + GENERAL_FAQS.length + FAMILIES_FAQS.length + NANNIES_FAQS.length} FAQs.`);

  for (let i = 0; i < TESTIMONIALS.length; i++) {
    await Testimonial.findOneAndUpdate(
      { name: TESTIMONIALS[i].name, quote: TESTIMONIALS[i].quote },
      { ...TESTIMONIALS[i], order: i, isPublished: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`[Seed] Upserted ${TESTIMONIALS.length} testimonials.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});
