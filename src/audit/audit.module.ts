import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ExtractorService } from './extractor.service';
import { FetcherService } from './fetcher.service';
import { RulesService } from './rules.service';

@Module({
  providers: [AuditService, FetcherService, ExtractorService, RulesService],
  exports: [AuditService],
})
export class AuditModule {}
