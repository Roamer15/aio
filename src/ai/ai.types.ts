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
