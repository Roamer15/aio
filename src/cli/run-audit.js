#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuditService } from './audit/audit.service';

async function runAudit(target: string, languages: string[]): Promise<void> {
  const app = await NestFactory.create(AuditModule);
  const auditService = app.get(AuditService);

  try {
    // detect if it's a URL or folder path
    const isUrl = /^https?:\/\//i.test(target);
    const auditOptions = isUrl
      ? { url: target, languages: languages as ('fr' | 'en')[] }
      : { folder: target, languages: languages as ('fr' | 'en')[] };

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
        if (f.file) {
          console.log(`      📁 ${f.file}`);
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
  const languages = args[1] ? args[1].split(',') : ['fr', 'en'];

  if (!target) {
    console.error('Usage: node run-audit.js <target> [languages]');
    console.error('Example: node run-audit.js ./site fr,en');
    console.error('Example: node run-audit.js https://example.com fr,en');
    process.exit(1);
  }

  await runAudit(target, languages);
}

main().catch((err) => {
  console.error('Error running audit:', err);
  process.exit(1);
});
