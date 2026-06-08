import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function getGitDiff(filePath: string): string {
  try {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      // GitHub Actions provides the base ref (e.g., 'main') and head ref (e.g., 'feature-branch')
      const base = process.env.GITHUB_BASE_REF || 'origin/main';
      return execSync(`git diff ${base}...HEAD -- "${filePath}"`, { encoding: 'utf8' });
    }
    
    // Local fallback
    let diff = execSync(`git diff HEAD -- "${filePath}"`, { encoding: 'utf8' });
    if (!diff.trim()) {
      diff = execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
    }
    return diff;
  } catch (e) {
    console.warn(`⚠️ Could not get git diff for ${filePath}`);
    return '';
  }
}

async function main() {
  console.log('🤖 Starting AI-Assisted Contract Validation (Qwen2.5-Coder 3B)...');

  const schemaPath = path.resolve(__dirname, '../../packages/schema/src/schema.graphql');
  const resolversPath = path.resolve(__dirname, '../../apps/api/src/resolvers/user.ts');
  const operationsPath = path.resolve(__dirname, '../../apps/web/src/graphql/operations.ts');
  const pagePath = path.resolve(__dirname, '../../apps/web/src/app/page.tsx');

  const files = [
    { name: 'GraphQL Operations', path: operationsPath },
    { name: 'Frontend Page', path: pagePath },
  ];

  // 1. Get backend changes
  const schemaDiff = getGitDiff(schemaPath);
  const resolversDiff = getGitDiff(resolversPath);

  if (!schemaDiff.trim() && !resolversDiff.trim()) {
    console.log('✅ No backend changes detected in Schema or Resolvers. Skipping AI inspection.');
    process.exit(0);
  }

  // 2. Read frontend files
  const fileContents: Record<string, string> = {};
  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      console.warn(`⚠️ Warning: Missing ${file.name} at "${file.path}". Skipping AI inspection.`);
      process.exit(0);
    }
    let content = fs.readFileSync(file.path, 'utf8');
    
    if (file.name === 'Frontend Page') {
      // Strip JSX layout entirely
      const returnIndex = content.indexOf('return (');
      if (returnIndex !== -1) {
        content = content.substring(0, returnIndex) + '\n  // ... UI layout omitted ...\n}';
      }
      
      // Clean out extensive imports or purely internal hooks to save tokens
      content = content.replace(/import\s+type\s+[\s\S]*?from\s+'.*';/g, ''); 
    }
    
    fileContents[file.name] = content;
  }

  const systemPrompt = 'You are an AI code reviewer and GraphQL consistency auditor. Always output pure, valid JSON matching the requested interface. Never include HTML, markdown wrappers (like ```json), or conversational prefix/suffix.';

  try {
    console.log('🧠 Step 1: Sending unified prompt to self-hosted Qwen2.5-Coder 3B...');

    const unifiedPrompt = `
You are an AI code reviewer and GraphQL consistency auditor.
Analyze the provided backend Git diffs and evaluate if they introduce breaking changes or semantic drift into the provided frontend code.

=== 1. GraphQL Schema DIFF ===
${schemaDiff || '(No changes)'}

=== 2. API Resolvers DIFF ===
${resolversDiff || '(No changes)'}

=== 3. Frontend GraphQL Operations ===
${fileContents['GraphQL Operations']}

=== 4. Frontend Page Code ===
${fileContents['Frontend Page']}

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface AuditReport {
  thinking: string; 
  status: "PASS" | "WARN" | "FAIL";
  backend_changes_summary: string;
  findings: Array<{
    file: string;
    level: "error" | "warning";
    description: string;
    suggestion: string;
  }>;
  explanation: string;
}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: unifiedPrompt }
    ];

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000), // Reduced timeout to 5 mins
      body: JSON.stringify({
        model: 'qwen2.5-coder:3b',
        messages: messages,
        stream: false,
        format: 'json', // ✨ Forces Ollama to output valid JSON
        options: { 
          temperature: 0.1, 
          num_predict: 1200 
        },
      }),
    });

    if (!response.ok) throw new Error(`Ollama API responded with status ${response.status}`);
    const data = (await response.json()) as any;
    const rawContent = data.message?.content?.trim() || '';

    // Sanitize JSON
    let cleanJson = rawContent.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    const report = JSON.parse(cleanJson);

    console.log('\n==========================================');
    console.log('📝 AI CONTRACT AUDIT REPORT SUMMARY');
    console.log('==========================================');

    if (report.thinking) {
      console.log('\n🧠 Model Thinking & Reasoning Process:');
      console.log('------------------------------------------');
      console.log(report.thinking);
      console.log('------------------------------------------');
    }

    if (report.backend_changes_summary) {
      console.log('\n🔙 Backend Changes Summary:');
      console.log('------------------------------------------');
      console.log(report.backend_changes_summary);
      console.log('------------------------------------------');
    }

    console.log('\n🚦 Validation Verdict:');
    if (report.status === 'PASS') {
      console.log('✅ APPROVED (PASS) - The contracts are fully consistent and validated.');
    } else if (report.status === 'WARN') {
      console.log('⚠️ APPROVED WITH WARNINGS (WARN) - Minor issues or deprecations detected, but not blocking.');
    } else {
      console.log('❌ NOT APPROVED (FAIL) - Invalidated due to critical inconsistencies or errors.');
    }

    console.log(`\nExplanation: ${report.explanation}`);

    if (report.findings && report.findings.length > 0) {
      console.log('\n🔍 Findings & Error Locations:');
      console.table(report.findings);
    } else {
      console.log('\n✨ No semantic anomalies, type conflicts, or inconsistencies detected. Codebases are perfectly aligned.');
    }

    console.log('\n==========================================');
    console.log('✅ AI Audit completed successfully.');

    // If status is FAIL, exit with code 1 to block CI/CD pipeline
    if (report.status === 'FAIL') {
      console.error('\n❌ AI analysis determined a critical mismatch (FAIL). Halting pipeline.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Failed to run AI contract verification:', error.message);
    console.warn('⚠️ Ollama/Qwen model might not be ready or running. Skipping AI check.');
    // Don't fail the build if the local model service is temporarily unreachable
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
