import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function getGitDiff(filePath: string): string {
  try {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      // GitHub Actions provides the base ref (e.g., 'main')
      const baseRef = process.env.GITHUB_BASE_REF || 'main';
      const remoteBase = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;

      try {
        // Try to fetch the target branch to fix shallow clone errors (fetch-depth: 1)
        execSync(`git fetch origin ${baseRef.replace('origin/', '')} --depth=1`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore fetch errors
      }

      try {
        return execSync(`git diff ${remoteBase}...HEAD -- "${filePath}"`, { encoding: 'utf8' });
      } catch (e) {
        // Fallback if the remoteBase is still not found
        return execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
      }
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

function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      if (file !== 'generated' && file !== 'node_modules' && file !== '.next') {
        getFilesRecursively(filepath, fileList);
      }
    } else {
      const ext = path.extname(filepath);
      if (['.ts', '.tsx'].includes(ext)) {
        fileList.push(filepath);
      }
    }
  }
  return fileList;
}

function getFileDescription(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const comments: string[] = [];
    let inBlockComment = false;

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i].trim();

      if (line.startsWith('/*')) {
        inBlockComment = true;
        comments.push(line.replace('/*', ''));
        if (line.endsWith('*/')) {
          inBlockComment = false;
        }
      } else if (inBlockComment) {
        comments.push(line.replace('*/', ''));
        if (line.endsWith('*/')) {
          inBlockComment = false;
        }
      } else if (line.startsWith('//')) {
        comments.push(line.replace(/^\/\/+/, '').trim());
      } else if (line.length > 0 && !line.startsWith('import') && !line.startsWith("'use client'")) {
        break;
      }
    }

    let description = comments.join(' ').trim();
    description = description
      .replace(/^\s*\*\s*/gm, '') // Remove lead asterisks in jsdoc
      .replace(/Description:\s*/i, '') // Remove "Description:" prefix label
      .replace(/\s+/g, ' ');
    return description || 'No description provided in file headers.';
  } catch (e) {
    return 'Could not read description.';
  }
}

async function callOllama(messages: Array<{ role: string; content: string }>, numPredict = 1200): Promise<string> {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(300000), // 5 min timeout
    body: JSON.stringify({
      model: 'qwen2.5-coder:3b',
      messages: messages,
      stream: false,
      format: 'json', // Forces Ollama to output valid JSON
      options: {
        temperature: 0.1,
        num_predict: numPredict
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API responded with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  const rawContent = data.message?.content?.trim() || '';
  return rawContent.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
}

async function main() {
  console.log('🤖 Starting AI-Assisted Contract Validation (Qwen2.5-Coder 3B)...');

  const schemaPath = path.resolve(__dirname, '../../packages/schema/src/schema.graphql');
  const resolversPath = path.resolve(__dirname, '../../apps/api/src/resolvers/user.ts');

  // 1. Get backend changes
  const schemaDiff = getGitDiff(schemaPath);
  const resolversDiff = getGitDiff(resolversPath);

  if (!schemaDiff.trim() && !resolversDiff.trim()) {
    console.log('✅ No backend changes detected in Schema or Resolvers. Skipping AI inspection.');
    process.exit(0);
  }

  console.log('🔙 Backend changes detected. Scanning frontend workspace...');

  // 2. Scan frontend directory recursively
  const srcDir = path.resolve(__dirname, '../../apps/web/src');
  const allFiles = getFilesRecursively(srcDir);

  const catalog = allFiles.map(filePath => {
    const relativePath = path.relative(srcDir, filePath).replace(/\\/g, '/');
    const description = getFileDescription(filePath);
    return {
      relativePath,
      fullPath: filePath,
      description
    };
  });

  console.log(`📂 Scanned ${catalog.length} frontend files for evaluation:`);
  for (const item of catalog) {
    console.log(`  - [${item.relativePath}]: "${item.description}"`);
  }

  const systemPrompt = 'You are an AI code reviewer and GraphQL consistency auditor. Always output pure, valid JSON matching the requested interface. Never include HTML, markdown wrappers (like ```json), or conversational prefix/suffix.';

  // 3. Step 1: Mapping affected files
  console.log('\n🧠 Step 1: Mapping backend changes to relevant frontend files...');

  const catalogText = catalog.map(item => `- Path: ${item.relativePath}\n  Description: ${item.description}`).join('\n');
  const mappingPrompt = `
You are a highly analytical AI developer and GraphQL consistency auditor.
We have detected changes in the backend GraphQL Schema and Resolvers.
Your task is to identify which frontend files from the catalog could be affected by these backend changes and must be inspected for semantic drift or breaks.

=== 1. Backend GraphQL Schema DIFF ===
${schemaDiff || '(No changes)'}

=== 2. Backend API Resolvers DIFF ===
${resolversDiff || '(No changes)'}

=== 3. Frontend Files Catalog ===
${catalogText}

Review the diffs carefully. Any files in the frontend catalog that deal with user profiles, transaction updates, tiers, credits, dashboard page views, or GraphQL operations that are related to the modified backend fields or types MUST be reviewed.
For example:
- If a resolver/schema changes how user tiers or credits are evaluated/returned, select files related to ledger state, user lists, forms, styles, history, or operations.
- If no files are affected, return an empty list.

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface FileMappingReport {
  thinking: string; // Detail your reasoning for selecting or skipping each file.
  relevant_files: string[]; // Relative paths from the catalog that are affected and must be reviewed.
}
`;

  let selectedFiles: string[] = [];
  try {
    const mappingResponse = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: mappingPrompt }
    ], 800);

    const mappingReport = JSON.parse(mappingResponse);
    selectedFiles = mappingReport.relevant_files || [];

    console.log('\n🧠 Step 1 Mapping Reason:');
    console.log('------------------------------------------');
    console.log(mappingReport.thinking);
    console.log('------------------------------------------');
    console.log(`🎯 Relevant files mapped: [${selectedFiles.join(', ')}]`);
  } catch (err: any) {
    console.warn('⚠️ Step 1 (Mapping) failed or timed out:', err.message);
    // Fallback: use all catalog files as fallback so we don't skip check
    console.log('⚠️ Falling back to checking all frontend files.');
    selectedFiles = catalog.map(item => item.relativePath);
  }

  const selectedItems = catalog.filter(item => selectedFiles.includes(item.relativePath));
  if (selectedItems.length === 0) {
    console.log('✅ AI model determined that no frontend files are affected by this backend change. Passing.');
    process.exit(0);
  }

  // 4. Read selected files
  let frontendCodesText = '';
  for (const item of selectedItems) {
    if (fs.existsSync(item.fullPath)) {
      let code = fs.readFileSync(item.fullPath, 'utf8');
      // clean imports to save context window
      code = code.replace(/import\s+type\s+[\s\S]*?from\s+'.*';/g, '');
      frontendCodesText += `\n=== File: ${item.relativePath} ===\n${code}\n`;
    }
  }

  // 5. Step 2: Audit
  console.log('\n🧠 Step 2: Running audit on selected files...');
  const auditPrompt = `
You are an extremely strict AI code reviewer and GraphQL consistency auditor.
Your job is to catch SEMANTIC DRIFT and FUNCTIONALITY BREAKS between the backend and frontend.

CRITICAL INSTRUCTIONS:
1. Look at the API Resolvers DIFF and Schema DIFF. Identify any fields whose underlying data format, semantic meaning, or type has changed (e.g., a field now returning stringified JSON, raw HTML, or a different object structure, even if it still technically returns a "String").
2. If semantic changes exist, look at the selected Frontend Code files below. Examine EXACTLY HOW the frontend renders those specific fields.
   - Look for how the changed fields are used in JSX (e.g., inside \`<a href={...}>\`, as image sources, or directly rendered as text \`{...}\`).
   - Determine if the new data format from the backend will break the frontend rendering (e.g., an object passed to an \`href\`, or HTML rendered as escaped text).
3. If the frontend lacks mitigating logic (e.g. \`JSON.parse()\` or \`dangerouslySetInnerHTML\`) to handle the new format, you MUST output status: "FAIL". Do NOT assume the frontend handles backend changes automatically.

=== 1. GraphQL Schema DIFF ===
${schemaDiff || '(No changes)'}

=== 2. API Resolvers DIFF ===
${resolversDiff || '(No changes)'}

=== 3. Selected Frontend Codes ===
${frontendCodesText || '(No files selected)'}

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface AuditReport {
  thinking: string; // Detail exactly how the fields are returned by the resolvers and how they are consumed in the frontend JSX.
  status: "PASS" | "WARN" | "FAIL";
  backend_changes_summary: string;
  findings: Array<{
    file: string;
    level: "error" | "warning";
    description: string;
    suggestion: string;
    frontend_snippet?: string; // Provide the exact snippet of frontend code that would break.
    backend_diff_snippet?: string; // Provide the exact snippet of backend diff that caused the issue.
  }>;
  explanation: string;
}
`;

  try {
    const auditResponse = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: auditPrompt }
    ], 1200);

    const report = JSON.parse(auditResponse);

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
      for (const finding of report.findings) {
        console.log(`\n[${finding.level.toUpperCase()}] File: ${finding.file}`);
        console.log(`Description: ${finding.description}`);
        if (finding.backend_diff_snippet) {
          console.log(`\n--- Backend Diff Snippet ---\n${finding.backend_diff_snippet}\n----------------------------`);
        }
        if (finding.frontend_snippet) {
          console.log(`\n--- Frontend Snippet ---\n${finding.frontend_snippet}\n------------------------`);
        }
        console.log(`Suggestion: ${finding.suggestion}`);
      }
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
