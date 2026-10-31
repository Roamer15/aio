import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AiModule, AuditModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
