import type { BusinessInfo, Finding } from '../shared';

export type ContentLanguage = 'fr' | 'en';

export interface PageImage {
  src: string;
  context?: string;
}

export interface GenerateMetaInput {
  language: ContentLanguage;
  pageTitle?: string;
  pageContent: string;
  business: BusinessInfo;
  images?: PageImage[];
}

export interface MetaSuggestion {
  title: string;
  description: string;
  imageAltTexts: Array<{
    src: string;
    alt: string;
  }>;
  source: 'ai-suggestion';
}

export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  name: string;
  address: {
    '@type': 'PostalAddress';
    addressLocality: string;
    streetAddress: string;
  };
  telephone: string;
}

export interface PrioritizeFindingsInput {
  language: ContentLanguage;
  findings: Finding[];
}

export interface FindingPriority {
  findingId: string;
  rank: number;
  rationale: string;
  source: 'ai-suggestion';
}
