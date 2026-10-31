import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai/ai.service';
import { AppModule } from './app.module';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });

    it('provides AiService for application adapters', () => {
      expect(app.get(AiService)).toBeInstanceOf(AiService);
    });
  });
});
