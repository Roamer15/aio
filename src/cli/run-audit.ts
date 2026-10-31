#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';

async function runAudit(target: string, languages: ('fr' | 'en')[]): Promise<void> {
  const app = await NestFactory.createApplicationContext(AuditModule);
  try {
    const auditService = app.get(AuditService);
    const isUrl = /^https?:\/\//i.test(target);
    const auditOptions = isUrl
      ? { url: target, languages }
      : { folder: target, languages };

    const { score, findings } = await auditService.audit(auditOptions);

    console.log('\n📊 AUDIT RESULT');
    console.log(`   Target: ${target}`);
    console.log(`   Indicative score: ${score}/100\n`);

    if (findings.length === 0) {
      console.log('   ✅ No issues found!');
    } else {
      console.log(`   🚨 ${findings.length} issue(s):\n`);
      findings.forEach((f, i) => {
        const icon = f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${i + 1}. ${icon} ${f.rule}`);
        console.log(`      ${f.evidence}`);
        const location = f.file ?? f.url;
        if (location) {
          console.log(`      📁 ${location}`);
        }
      });
    }
  } finally {
    await app.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.error('Usage: npx ts-node src/cli/run-audit.ts <target> [languages]');
    console.error('Example: npx ts-node src/cli/run-audit.ts ./site fr,en');
    console.error('Example: npx ts-node src/cli/run-audit.ts https://example.com fr,en');
    process.exit(1);
  }

  const languages: ('fr' | 'en')[] = [];
  for (const language of args[1]?.split(',') ?? []) {
    const normalized = language.trim().toLowerCase();
    if (normalized !== 'fr' && normalized !== 'en') {
      throw new Error('Supported languages are fr and en.');
    }
    if (!languages.includes(normalized)) languages.push(normalized);
  }

  await runAudit(target, languages);
}

main().catch((err) => {
  console.error('Error running audit:', err);
  process.exitCode = 1;
});
