import { AiService } from './ai.service';

const describeGeminiIntegration =
  process.env.RUN_GEMINI_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeGeminiIntegration('Gemini API integration', () => {
  it('generates metadata using the configured model and API key', async () => {
    const service = new AiService();
    const result = await service.generateMeta({
      language: 'fr',
      pageTitle: 'Hôtel du Littoral',
      pageContent: 'Hôtel du Littoral est un établissement situé à Kribi.',
      business: {
        name: 'Hôtel du Littoral',
        city: 'Kribi',
        phone: '+237699000000',
        address: 'Avenue de la Plage, Kribi',
      },
    });

    expect(result.title.trim()).not.toBe('');
    expect(result.description.trim()).not.toBe('');
    expect(result.imageAltTexts).toEqual([]);
  }, 30_000);
});
