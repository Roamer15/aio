const { NestFactory } = require('@nestjs/core');
const { AiService } = require('../dist/src/ai/ai.service');
const { AppModule } = require('../dist/src/app.module');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const aiService = app.get(AiService);
    const result = await aiService.generateMeta({
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

    console.log(
      JSON.stringify(
        {
          title: result.title,
          description: result.description,
          source: result.source,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
  process.exitCode = 1;
});
