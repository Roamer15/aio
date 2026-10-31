import { NestFactory } from '@nestjs/core';
import { AuditModule } from '../src/audit/audit.module';
import { AuditService } from '../src/audit/audit.service';

async function main() {
  const args = process.argv.slice(2);
  const folderPath = args[0];

  if (!folderPath) {
    console.error('Error: Please provide a folder path to audit.');
    console.error('Usage: pnpm run audit-demo ./path/to/site');
    process.exit(1);
  }

  console.log(`🚀 Starting LocalSEO AI audit on: ${folderPath}\n`);

  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
  try {
    app = await NestFactory.createApplicationContext(AuditModule);
    const auditService = app.get(AuditService);

    const result = await auditService.audit({ folder: folderPath, languages: ['fr', 'en'] });

    console.log('📊 AUDIT RESULTS');
    console.log('=' .repeat(50));
    console.log(`Target: ${folderPath}`);
    console.log(`Score: ${result.score}/100\n`);

    if (result.findings.length === 0) {
      console.log('✅ No issues found! The site appears to be well optimized.');
    } else {
      console.log(`🚨 Found ${result.findings.length} issue(s):\n`);

      result.findings.forEach((finding, index) => {
        const severityIcon = finding.severity === 'high' ? '🔴' : 
                           finding.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${index + 1}. ${severityIcon} ${finding.rule.toUpperCase()}`);
        console.log(`   File: ${finding.file || 'N/A'}`);
        console.log(`   Evidence: ${finding.evidence}`);
        console.log(`   Fixable: ${finding.fixable ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    const highCount = result.findings.filter(f => f.severity === 'high').length;
    const mediumCount = result.findings.filter(f => f.severity === 'medium').length;
    const lowCount = result.findings.filter(f => f.severity === 'low').length;

    console.log('📈 SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total findings: ${result.findings.length}`);
    console.log(`High severity: ${highCount}`);
    console.log(`Medium severity: ${mediumCount}`);
    console.log(`Low severity: ${lowCount}`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Error running audit:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await app?.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { main };