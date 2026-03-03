/** Category keywords for auto-categorisation of bank transactions */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  software: ['stripe', 'github', 'aws', 'heroku', 'vercel', 'figma', 'notion', 'slack', 'adobe', 'google cloud', 'digital ocean', 'cloudflare', 'openai', 'anthropic', 'railway', 'supabase', 'microsoft', 'zoom', 'canva'],
  hosting: ['hosting', 'domain', 'namecheap', 'godaddy', 'dns', 'linode'],
  marketing: ['facebook ads', 'google ads', 'linkedin', 'mailchimp', 'convertkit', 'advertising', 'sponsor', 'meta ads'],
  office: ['office', 'desk', 'chair', 'monitor', 'keyboard', 'stationery', 'amazon', 'equipment', 'laptop', 'apple store'],
  travel: ['uber', 'lyft', 'train', 'flight', 'hotel', 'airbnb', 'travel', 'parking', 'fuel', 'petrol', 'tfl', 'national rail'],
  professional: ['accountant', 'lawyer', 'solicitor', 'consultant', 'companies house'],
  subscriptions: ['subscription', 'spotify', 'netflix', 'gym', 'membership', 'apple.com', 'icloud', 'openai', 'chatgpt'],
  insurance: ['insurance', 'indemnity', 'liability', 'hiscox'],
  tax: ['hmrc', 'corporation tax', 'corp tax', 'self assessment'],
  vat: ['vat payment', 'vat return'],
  pension: ['pension', 'nest', 'workplace pension', 'auto enrolment'],
};

export function suggestCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'other';
}
