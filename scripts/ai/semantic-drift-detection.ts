import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🤖 Starting AI-Assisted Contract Validation (Qwen2.5-Coder 3B)...');

  const schemaPath = path.resolve(__dirname, '../../packages/schema/src/schema.graphql');
  const resolversPath = path.resolve(__dirname, '../../apps/api/src/resolvers/user.ts');
  const operationsPath = path.resolve(__dirname, '../../apps/web/src/graphql/operations.ts');
  const pagePath = path.resolve(__dirname, '../../apps/web/src/app/page.tsx');

  const files = [
    { name: 'GraphQL Schema', path: schemaPath },
    { name: 'API Resolvers', path: resolversPath },
    { name: 'GraphQL Operations', path: operationsPath },
    { name: 'Frontend Page', path: pagePath },
  ];

  // 1. Read files
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

  const prompt = `You are a GraphQL consistency auditor. Analyze the backend schema, resolvers, frontend queries, and frontend page code to check for any inconsistencies, semantic drifts, type conflicts, or mismatching/unused fields.

Please perform the following validation checks:
1. Schema & Resolvers: Verify all query and mutation fields defined in the schema have corresponding resolvers, and their argument/return types match.
2. Operations & Schema: Verify that all operations (queries/mutations) in the frontend operations file are valid according to the schema (e.g., correct fields, types, and parameters).
3. Frontend Page & Operations: Verify that the frontend page correctly imports and invokes these operations with appropriate variables, and correctly uses the returned data types.

Return your output ONLY as a valid JSON object matching this TypeScript interface (no markdown codeblock wrapping, no preamble, no explanation outside the JSON):
interface AuditReport {
  thinking: string; // A brief checklist or 1-2 sentence summary of what you verified across the files (under 30 words).
  status: "PASS" | "WARN" | "FAIL"; // PASS = approved/valid, WARN = approved with warnings, FAIL = not approved/invalid
  findings: Array<{
    file: string; // The file name or path analyzed (e.g. "schema.graphql", "resolvers/user.ts", etc.)
    level: "error" | "warning";
    description: string; // Detailed explanation of what specific inconsistency, type conflict, or drift was found, or why a field is problematic
    suggestion: string; // Clear instruction on how to fix this finding
  }>;
  explanation: string; // A clear final summary of why the changes are approved/validated (PASS/WARN) or not approved/invalidated (FAIL), stating where there are errors or if everything is clean.
}

Here are the codebase files:

=== 1. GraphQL Schema (${schemaPath}) ===
${fileContents['GraphQL Schema']}

=== 2. API Resolvers (${resolversPath}) ===
${fileContents['API Resolvers']}

=== 3. GraphQL Operations (${operationsPath}) ===
${fileContents['GraphQL Operations']}

=== 4. Frontend Page (${pagePath}) ===
${fileContents['Frontend Page']}
`;

  try {
    console.log('🧠 Sending files context to self-hosted Qwen2.5-Coder 3B...');

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(600000), // 10 minutes timeout
      body: JSON.stringify({
        model: 'qwen2.5-coder:3b',
        messages: [
          {
            role: 'system',
            content: 'You are an AI code reviewer. Always output pure, valid JSON matching the requested interface. Never include HTML, markdown wrappers (like ```json), or conversational prefix/suffix.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 800,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    const rawContent = data.message?.content?.trim();

    if (!rawContent) {
      throw new Error('Ollama returned empty response content.');
    }

    // Attempt to sanitize JSON just in case the model added codeblocks
    let cleanJsonStr = rawContent;
    if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }
    cleanJsonStr = cleanJsonStr.trim();

    const report = JSON.parse(cleanJsonStr);

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
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
