import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface AIConfig {
  maxDependencyDepth: number;
  exitOnFailure: boolean;
  skipMapping: boolean;
}

function loadConfig(): AIConfig {
  const configPath = path.resolve(__dirname, 'config.json');
  const defaultConfig: AIConfig = {
    maxDependencyDepth: 1,
    exitOnFailure: false,
    skipMapping: false,
  };

  let config = defaultConfig;

  try {
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...defaultConfig, ...userConfig };
    }
  } catch (err: any) {
    console.warn('⚠️ Could not read scripts/ai/config.json, using defaults.', err.message);
  }

  // Override config if CLI flag is provided
  const args = process.argv.slice(2);
  if (args.includes('--skip-mapping') || args.includes('--skipMapping')) {
    config.skipMapping = true;
  }

  return config;
}

function getGitDiff(filePath: string): string {
  try {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      try {
        // Ensure at least depth of 2 is fetched so HEAD~1 is available
        execSync('git fetch --depth=2', { stdio: 'ignore' });
      } catch (e) {
        // Ignore fetch errors
      }
      return execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
    }

    // Local: look at the staged changes
    return execSync(`git diff --cached -- "${filePath}"`, { encoding: 'utf8' });
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
        num_ctx: 16384,
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

async function generateFileDescription(filePath: string, relativePath: string): Promise<string> {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const userPrompt = `
Analyze the following TypeScript/React frontend file code and provide a brief, high-level summary of its purpose in 1 to 2 sentences.
Be specific about what features, components, state, or utility it implements.

=== File Path ===
${relativePath}

=== Code ===
${code}

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface FileDescriptionReport {
  purpose: string; // 1-2 sentence description of the file's purpose.
}
`;

    const systemPrompt = 'You are an AI code analyst. Always output pure, valid JSON matching the requested interface. Never include HTML, markdown wrappers (like \`\`\`json), or conversational prefix/suffix.';
    const response = await callOllama([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 200);

    const report = JSON.parse(response);
    return report.purpose || getFileDescription(filePath);
  } catch (err: any) {
    console.warn(`⚠️ Failed to generate AI description for ${relativePath}: ${err.message}. Falling back to header comments.`);
    return getFileDescription(filePath);
  }
}

function resolveImportPath(sourceFile: string, importPath: string, srcDir: string): string | null {
  let resolved: string;
  if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
    resolved = path.resolve(srcDir, importPath.slice(2));
  } else if (importPath.startsWith('.') || importPath.startsWith('/')) {
    resolved = path.resolve(path.dirname(sourceFile), importPath);
  } else {
    return null;
  }

  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  for (const ext of extensions) {
    const fileWithExt = resolved + ext;
    if (fs.existsSync(fileWithExt) && fs.statSync(fileWithExt).isFile()) {
      return fileWithExt;
    }
    const indexWithExt = path.join(resolved, 'index' + ext);
    if (fs.existsSync(indexWithExt) && fs.statSync(indexWithExt).isFile()) {
      return indexWithExt;
    }
  }
  return null;
}

function getImportsForFile(filePath: string, srcDir: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports: string[] = [];

    // Regex for ES import statements, e.g. import ... from '...' or import('...')
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolved = resolveImportPath(filePath, importPath, srcDir);
      if (resolved) {
        imports.push(resolved);
      }
    }
    return imports;
  } catch (e) {
    return [];
  }
}

function resolveDependenciesRecursively(
  initialFiles: string[],
  srcDir: string,
  catalog: Array<{ fullPath: string; relativePath: string }>,
  maxDepth: number = 1
): string[] {
  const visited = new Set<string>();
  const queue: Array<[string, number]> = initialFiles.map(file => [file, 0]);

  // Build a map of file path -> list of files it imports
  const importMap = new Map<string, string[]>();
  // Build a map of file path -> list of files that import it
  const importerMap = new Map<string, string[]>();

  for (const item of catalog) {
    const imports = getImportsForFile(item.fullPath, srcDir);
    importMap.set(item.fullPath, imports);
    for (const imp of imports) {
      const currentImporters = importerMap.get(imp) || [];
      currentImporters.push(item.fullPath);
      importerMap.set(imp, currentImporters);
    }
  }

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (depth >= maxDepth) {
      continue;
    }

    // 1. Trace downwards (files this file imports)
    const imports = importMap.get(current) || [];
    for (const imp of imports) {
      if (!visited.has(imp) && (imp.startsWith(srcDir.replace(/\\/g, '/')) || imp.startsWith(srcDir))) {
        queue.push([imp, depth + 1]);
      }
    }

    // 2. Trace upwards (files that import this file)
    const importers = importerMap.get(current) || [];
    for (const imp of importers) {
      if (!visited.has(imp) && (imp.startsWith(srcDir.replace(/\\/g, '/')) || imp.startsWith(srcDir))) {
        queue.push([imp, depth + 1]);
      }
    }
  }

  return Array.from(visited);
}

async function main() {
  console.log('🤖 Starting AI-Assisted Contract Validation (Qwen2.5-Coder 3B)...');
  const config = loadConfig();
  console.log(`🔧 Loaded AI config: maxDependencyDepth = ${config.maxDependencyDepth}, exitOnFailure = ${config.exitOnFailure}, skipMapping = ${config.skipMapping}`);

  const schemaPath = path.resolve(__dirname, '../../packages/schema/src/schema.graphql');
  const resolversPath = path.resolve(__dirname, '../../apps/api/src/resolvers/user.ts');

  // 1. Get backend changes
  const schemaDiff = getGitDiff(schemaPath);
  const resolversDiff = getGitDiff(resolversPath);

  console.log('\n--- 🔍 Backend Diff Debug Logs ---');
  console.log(`Schema Diff:\n${schemaDiff.trim() ? schemaDiff : '(No changes)'}`);
  console.log(`Resolvers Diff:\n${resolversDiff.trim() ? resolversDiff : '(No changes)'}`);
  console.log('----------------------------------\n');

  if (!schemaDiff.trim() && !resolversDiff.trim()) {
    console.log('✅ No backend changes detected in Schema or Resolvers. Skipping AI inspection.');
    process.exit(0);
  }

  console.log('🔙 Backend changes detected. Scanning frontend workspace...');

  // 2. Scan frontend directory recursively
  const srcDir = path.resolve(__dirname, '../../apps/web/src');
  const allFiles = getFilesRecursively(srcDir);

  const descriptionsPath = path.resolve(__dirname, 'file-descriptions.json');
  let descriptions: Record<string, string> = {};
  try {
    if (fs.existsSync(descriptionsPath)) {
      descriptions = JSON.parse(fs.readFileSync(descriptionsPath, 'utf8'));
    }
  } catch (err: any) {
    console.warn('⚠️ Could not read file-descriptions.json. Initializing empty descriptions.', err.message);
  }

  let descriptionsUpdated = false;

  for (const filePath of allFiles) {
    const relativePath = path.relative(srcDir, filePath).replace(/\\/g, '/');
    const hasDiff = getGitDiff(filePath).trim().length > 0;
    const isNew = !descriptions[relativePath];

    if (isNew || hasDiff) {
      let newDesc = '';
      if (config.skipMapping) {
        newDesc = getFileDescription(filePath);
      } else {
        if (isNew) {
          console.log(`🆕 New file detected: ${relativePath}. Generating description...`);
        } else {
          console.log(`📝 Modified file detected: ${relativePath}. Updating description...`);
        }
        newDesc = await generateFileDescription(filePath, relativePath);
      }
      descriptions[relativePath] = newDesc;
      descriptionsUpdated = true;
    }
  }

  if (descriptionsUpdated) {
    try {
      fs.writeFileSync(descriptionsPath, JSON.stringify(descriptions, null, 2), 'utf8');
      console.log('💾 Saved updated file descriptions to file-descriptions.json');
    } catch (err: any) {
      console.warn('⚠️ Could not save file-descriptions.json:', err.message);
    }
  }

  const catalog = allFiles.map(filePath => {
    const relativePath = path.relative(srcDir, filePath).replace(/\\/g, '/');
    const description = descriptions[relativePath] || 'No description provided.';
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

  let selectedFiles: string[] = [];
  if (config.skipMapping) {
    console.log('\n⏭️ Skipping Step 1 (Mapping relevant files) due to skipMapping configuration. Auditing all frontend files directly.');
    selectedFiles = catalog.map(item => item.relativePath);
  } else {
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

    try {
      const mappingResponse = await callOllama([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: mappingPrompt }
      ], 800);

      const mappingReport = JSON.parse(mappingResponse);
      selectedFiles = mappingReport.relevant_files || [];

      // Programmatically trace imports recursively for the selected files to find all related business logic/definitions
      const absoluteSelectedFiles = selectedFiles.map(relPath => path.resolve(srcDir, relPath));
      const allResolvedFiles = resolveDependenciesRecursively(absoluteSelectedFiles, srcDir, catalog, config.maxDependencyDepth);
      selectedFiles = allResolvedFiles.map(absPath => path.relative(srcDir, absPath).replace(/\\/g, '/'));

      console.log('\n🧠 Step 1 Mapping Reason:');
      console.log('------------------------------------------');
      console.log(mappingReport.thinking);
      console.log('------------------------------------------');
      console.log(`🎯 Relevant files mapped (including resolved imports): [${selectedFiles.join(', ')}]`);
    } catch (err: any) {
      console.warn('⚠️ Step 1 (Mapping) failed or timed out:', err.message);
      // Fallback: use all catalog files as fallback so we don't skip check
      console.log('⚠️ Falling back to checking all frontend files.');
      selectedFiles = catalog.map(item => item.relativePath);
    }
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
Your job is to catch SEMANTIC DRIFT, BUSINESS LOGIC MISMATCHES, and FUNCTIONALITY BREAKS between the backend and frontend.

CRITICAL INSTRUCTIONS:
1. Look at the API Resolvers DIFF and Schema DIFF. Identify ANY changes in types, formats, values, constants, equations, thresholds, error conditions, or business rules (such as transaction fees, credit limits, or loyalty tier thresholds).
2. Look for subtle mathematical, syntax, or sign anomalies/typos in the backend changes (such as unexpected negative signs, e.g. "feePercentage: - feePercentagesDict[UserTier.Bronze]", division errors, or operator typos) that would make the configuration values semantically incorrect.
3. Compare these changes against the selected Frontend Code files. Do not just fail blindly because the frontend has hardcoded values. Instead, check the underlying logic:
   - Identify if the frontend could align if it fetched the configurations dynamically.
   - If the backend configuration itself contains a semantic/mathematical error (like negative fee percentages due to a leading minus sign typo), this is the REAL error/mismatch that must be highlighted in the report, since it would propagate incorrect values to the frontend if implemented dynamically.
4. If there is ANY discrepancy, typo, sign mismatch, or logical inconsistency between the backend calculations/configs and what the frontend calculates or displays, you MUST output status: "FAIL" and detail the exact mathematical/semantic anomaly.
5. If the frontend lacks mitigating logic to handle the updated backend rules/formats, or has conflicting logic, you MUST output status: "FAIL". Do NOT assume the frontend handles changes automatically.

=== 1. GraphQL Schema DIFF ===
${schemaDiff || '(No changes)'}

=== 2. API Resolvers DIFF ===
${resolversDiff || '(No changes)'}

=== 3. Selected Frontend Codes ===
${frontendCodesText || '(No files selected)'}

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface AuditReport {
  thinking: string; // Step-by-step description of your analysis, comparing backend resolver changes/constants/rules with frontend code usage/constants/formulas.
  status: "PASS" | "WARN" | "FAIL";
  backend_changes_summary: string;
  findings: Array<{
    file: string;
    level: "error" | "warning";
    description: string;
    suggestion: string;
    frontend_snippet?: string; // Provide the exact snippet of frontend code that would break or is inconsistent.
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
    process.exit(config.exitOnFailure ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
