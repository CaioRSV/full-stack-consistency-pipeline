import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function getGitDiff(filePath: string): string {
  try {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      return execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
    } else {
      let diff = execSync(`git diff HEAD -- "${filePath}"`, { encoding: 'utf8' });
      if (!diff.trim()) {
        diff = execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
      }
      return diff;
    }
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
      // Strip large JSX return to optimize Ollama prefill/inference speed on CPU
      const returnIndex = content.indexOf('return (');
      if (returnIndex !== -1) {
        content = content.substring(0, returnIndex) + '\n  // ... JSX layout content omitted for validation speed ...\n}';
      }
    }
    fileContents[file.name] = content;
  }

  const systemPrompt = 'You are an AI code reviewer and GraphQL consistency auditor. Always output pure, valid JSON matching the requested interface. Never include HTML, markdown wrappers (like ```json), or conversational prefix/suffix.';

  try {
    console.log('🧠 Step 1: Sending backend files to self-hosted Qwen2.5-Coder 3B...');

    const prompt1 = `Analyze the following git diffs for the backend GraphQL schema and resolvers.
Map out what has CHANGED (added, removed, modified queries/mutations and their types). Identify potential areas where a frontend could break due to these specific changes (e.g., missing new required fields, removed fields, type mismatches).

Return your output ONLY as a valid JSON object matching this interface:
{
  "backend_analysis": "Summary of what changed in the backend contract",
  "frontend_risk_areas": ["List of things the frontend must update/handle due to these changes"]
}

=== 1. GraphQL Schema DIFF ===
${schemaDiff || '(No changes in schema)'}

=== 2. API Resolvers DIFF ===
${resolversDiff || '(No changes in resolvers)'}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt1 },
    ];

    const response1 = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify({
        model: 'qwen2.5-coder:3b',
        messages: messages,
        stream: false,
        options: { temperature: 0.1, num_predict: 800 },
      }),
    });

    if (!response1.ok) throw new Error(`Ollama API responded with status ${response1.status}`);
    const data1 = (await response1.json()) as any;
    const rawContent1 = data1.message?.content?.trim() || '';

    // Sanitize JSON
    let cleanJson1 = rawContent1.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    const backendAnalysis = JSON.parse(cleanJson1);
    
    console.log('✅ Backend analysis complete. Identified risk areas for frontend:');
    backendAnalysis.frontend_risk_areas?.forEach((r: string) => console.log(`  - ${r}`));

    // Add assistant reply to history
    messages.push({ role: 'assistant', content: rawContent1 });

    console.log('\n🧠 Step 2: Sending frontend files to verify against backend analysis...');

    const prompt2 = `Now, analyze the following frontend operations and page code. Check them against your previous backend analysis to find any inconsistencies, semantic drifts, type conflicts, or mismatching/unused fields.

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface AuditReport {
  thinking: string; // A brief checklist or 1-2 sentence summary of what you verified across the files (under 30 words).
  status: "PASS" | "WARN" | "FAIL"; // PASS = approved/valid, WARN = approved with warnings, FAIL = not approved/invalid
  findings: Array<{
    file: string; // The file name or path analyzed (e.g. "operations.ts", "page.tsx")
    level: "error" | "warning";
    description: string; // Detailed explanation of what specific inconsistency, type conflict, or drift was found, or why a field is problematic
    suggestion: string; // Clear instruction on how to fix this finding
  }>;
  explanation: string; // A clear final summary of why the changes are approved/validated (PASS/WARN) or not approved/invalidated (FAIL), stating where there are errors or if everything is clean.
}

=== 3. GraphQL Operations ===
${fileContents['GraphQL Operations']}

=== 4. Frontend Page ===
${fileContents['Frontend Page']}
`;

    messages.push({ role: 'user', content: prompt2 });

    const response2 = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify({
        model: 'qwen2.5-coder:3b',
        messages: messages,
        stream: false,
        options: { temperature: 0.1, num_predict: 1200 },
      }),
    });

    if (!response2.ok) throw new Error(`Ollama API responded with status ${response2.status}`);
    const data2 = (await response2.json()) as any;
    const rawContent2 = data2.message?.content?.trim() || '';

    let cleanJson2 = rawContent2.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
    const report = JSON.parse(cleanJson2);

    console.log('\n==========================================');
    console.log('📝 AI CONTRACT AUDIT REPORT SUMMARY');
    console.log('==========================================');

    if (report.thinking) {
      console.log('\n🧠 Model Thinking & Reasoning Process:');
      console.log('------------------------------------------');
      console.log(report.thinking);
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
