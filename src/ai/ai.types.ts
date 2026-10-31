export type ContentLanguage = 'fr' | 'en';

export interface BusinessContext {
  name: string;
  city: string;
  phone?: string;
  address?: string;
}

export interface PageImage {
  src: string;
  context?: string;
}

export interface GenerateMetaInput {
  language: ContentLanguage;
  pageTitle?: string;
  pageContent: string;
  business: BusinessContext;
  images?: PageImage[];
}

export interface MetaSuggestion {
  title: string;
  description: string;
  imageAltTexts: Array<{
    src: string;
    alt: string;
  }>;
}

export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  name: string;
  address: {
    '@type': 'PostalAddress';
    addressLocality: string;
    streetAddress?: string;
  };
  telephone?: string;
}

export type FindingSeverity = 'high' | 'medium' | 'low';

export interface FindingForPrioritization {
  id: string;
  rule: string;
  severity: FindingSeverity;
  file?: string;
  url?: string;
  evidence: string;
  fixable: boolean;
}

export interface PrioritizeFindingsInput {
  language: ContentLanguage;
  findings: FindingForPrioritization[];
}

export interface FindingPriority {
  findingId: string;
  rank: number;
  rationale: string;
  source: 'ai-suggestion';
}
