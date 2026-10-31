import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';

/**
 * CliModule — exposition of the tools as demo commands (owner: role C,
 * with the audit command built by role A).
 */
@Module({
  imports: [AuditModule],
})
export class CliModule {}

