import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AiService } from './ai.service';
import { FindingForPrioritization, GenerateMetaInput } from './ai.types';

interface MockGenerateContentRequest {
  model: string;
  contents: string;
  config: { responseMimeType: string };
}

const mockGenerateContent = jest.fn<
  Promise<{ text: string }>,
  [request: MockGenerateContentRequest]
>();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe('AiService', () => {
  const input: GenerateMetaInput = {
    language: 'fr',
    pageTitle: 'Accueil',
    pageContent: 'Un hôtel situé à Kribi.',
    business: { name: 'Hôtel du Littoral', city: 'Kribi' },
    images: [{ src: '/hotel.jpg', context: 'Façade de l’hôtel' }],
  };
  const findings: FindingForPrioritization[] = [
    {
      id: 'missing-title',
      rule: 'missing-title',
      severity: 'high',
      evidence: 'The page has no title element.',
      fixable: true,
    },
    {
      id: 'missing-alt',
      rule: 'missing-alt',
      severity: 'medium',
      evidence: 'One image has no alt text.',
      fixable: true,
    },
  ];

  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemma-test-model';
    mockGenerateContent.mockReset().mockResolvedValue({
      text: JSON.stringify({
        title: 'Hôtel du Littoral à Kribi',
        description: 'Découvrez cet hôtel situé à Kribi.',
        imageAltTexts: [
          { src: '/hotel.jpg', alt: 'Façade de l’hôtel à Kribi' },
        ],
      }),
    });
    jest.mocked(GoogleGenAI).mockClear();
  });

  afterAll(() => {
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }

    if (previousModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = previousModel;
    }
  });

  it('generates metadata in the requested language from the supplied context', async () => {
    const service = new AiService();

    await expect(service.generateMeta(input)).resolves.toEqual({
      title: 'Hôtel du Littoral à Kribi',
      description: 'Découvrez cet hôtel situé à Kribi.',
      imageAltTexts: [{ src: '/hotel.jpg', alt: 'Façade de l’hôtel à Kribi' }],
    });

    const [request] = mockGenerateContent.mock.calls[0];
    expect(request.model).toBe('gemma-test-model');
    expect(request.contents).toContain(
      'Write every generated value in French.',
    );
    expect(request.config).toEqual({ responseMimeType: 'application/json' });
  });

  it('rejects empty page content without calling Gemini', async () => {
    const service = new AiService();

    await expect(
      service.generateMeta({ ...input, pageContent: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('rejects malformed or unrequested image alt text from Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Titre',
        description: 'Description',
        imageAltTexts: [{ src: '/other.jpg', alt: 'Image' }],
      }),
    });
    const service = new AiService();

    await expect(service.generateMeta(input)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('creates LocalBusiness JSON-LD only from confirmed business fields', () => {
    const service = new AiService();

    expect(service.generateLocalBusinessJsonLd(input.business)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Hôtel du Littoral',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Kribi',
      },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('prioritizes every finding without changing its measured severity', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          findingId: 'missing-alt',
          rank: 2,
          rationale: 'À corriger après le titre.',
        },
        {
          findingId: 'missing-title',
          rank: 1,
          rationale: 'Le titre est absent.',
        },
      ]),
    });
    const service = new AiService();

    await expect(
      service.prioritizeFindings({ language: 'fr', findings }),
    ).resolves.toEqual([
      {
        findingId: 'missing-title',
        rank: 1,
        rationale: 'Le titre est absent.',
        source: 'ai-suggestion',
      },
      {
        findingId: 'missing-alt',
        rank: 2,
        rationale: 'À corriger après le titre.',
        source: 'ai-suggestion',
      },
    ]);
    expect(mockGenerateContent.mock.calls[0][0].contents).toContain(
      'Do not change, reinterpret, or invent finding facts or severity.',
    );
  });

  it('rejects priorities that do not reference the input findings', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([
        { findingId: 'unknown', rank: 1, rationale: 'Suggestion.' },
        { findingId: 'missing-alt', rank: 2, rationale: 'Suggestion.' },
      ]),
    });
    const service = new AiService();

    await expect(
      service.prioritizeFindings({ language: 'en', findings }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('does not call Gemini when there are no findings to prioritize', async () => {
    const service = new AiService();

    await expect(
      service.prioritizeFindings({ language: 'en', findings: [] }),
    ).resolves.toEqual([]);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
