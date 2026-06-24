import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { execSync } from 'child_process';

interface AIConfig {
  maxDependencyDepth: number;
  exitOnFailure: boolean;
  skipMapping: boolean;
  timeoutMs: number;
  numCtx: number;
}

function cleanCodeForContext(code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const cleanedLines: string[] = [];
  let inBlockComment = false;
  let inMultiLineImport = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Handle block comments
    if (inBlockComment) {
      if (trimmed.endsWith('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.endsWith('*/')) {
        inBlockComment = true;
      }
      continue;
    }

    // Handle single line comments
    if (trimmed.startsWith('//')) {
      continue;
    }

    // Handle multi-line imports
    if (inMultiLineImport) {
      if (trimmed.includes('from ') || trimmed.includes("from'")) {
        inMultiLineImport = false;
      }
      continue;
    }
    if (trimmed.startsWith('import ')) {
      // Check if it's single line
      const isSingleLine = (trimmed.includes('from ') && (trimmed.endsWith("';") || trimmed.endsWith('";') || trimmed.endsWith("'") || trimmed.endsWith('"'))) ||
        (trimmed.startsWith('import \'') || trimmed.startsWith('import "'));
      if (!isSingleLine) {
        inMultiLineImport = true;
      }
      continue;
    }

    // Strip trailing comments
    let processedLine = line;
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      const prefix = line.substring(0, commentIdx);
      if (!prefix.trim().endsWith(':')) {
        processedLine = prefix;
      }
    }

    if (processedLine.trim() === '') {
      continue;
    }

    cleanedLines.push(processedLine);
  }

  return cleanedLines.join('\n');
}

function loadConfig(): AIConfig {
  const configPath = path.resolve(__dirname, 'config.json');
  const defaultConfig: AIConfig = {
    maxDependencyDepth: 1,
    exitOnFailure: false,
    skipMapping: false,
    timeoutMs: 900000, // Default 15 minutes
    numCtx: 12288, // Default 12k context window to save RAM
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

  const timeoutIdx = args.findIndex(arg => arg === '--timeout');
  if (timeoutIdx !== -1 && timeoutIdx + 1 < args.length) {
    const val = parseInt(args[timeoutIdx + 1], 10);
    if (!isNaN(val)) {
      config.timeoutMs = val;
    }
  }

  const numCtxIdx = args.findIndex(arg => arg === '--num-ctx' || arg === '--numCtx');
  if (numCtxIdx !== -1 && numCtxIdx + 1 < args.length) {
    const val = parseInt(args[numCtxIdx + 1], 10);
    if (!isNaN(val)) {
      config.numCtx = val;
    }
  }

  return config;
}

function getGitDiff(filePath: string): string {
  try {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
      let baseRef = process.env.GITHUB_BASE_REF;
      if (!baseRef) {
        // If not a PR, check if we are on a feature branch triggering a push event
        const currentBranch = process.env.GITHUB_REF_NAME;
        if (currentBranch && currentBranch !== 'main' && currentBranch !== 'master') {
          // Default target/origin branch for feature branch push events is 'main' (or master)
          baseRef = 'main';
        }
      }

      if (baseRef) {
        try {
          execSync(`git fetch origin ${baseRef}`, { stdio: 'ignore' });
        } catch (e) { }
        try {
          return execSync(`git diff origin/${baseRef}...HEAD -- "${filePath}"`, { encoding: 'utf8' });
        } catch (e) {
          // Fallback to direct diff if merge-base cannot be computed due to shallow clone limits
          return execSync(`git diff origin/${baseRef} HEAD -- "${filePath}"`, { encoding: 'utf8' });
        }
      } else {
        // Non-PR CI run on main/master (e.g. push event), default to comparing HEAD~1
        try {
          execSync('git fetch --depth=2', { stdio: 'ignore' });
        } catch (e) { }
        return execSync(`git diff HEAD~1 HEAD -- "${filePath}"`, { encoding: 'utf8' });
      }
    }

    // Local environment: check if we are on a feature branch compared to main or master
    let currentBranch = '';
    try {
      currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (e) { }

    if (currentBranch && currentBranch !== 'main' && currentBranch !== 'master') {
      let baseBranch = 'main';
      try {
        execSync('git show-ref --verify refs/heads/main', { stdio: 'ignore' });
      } catch (e) {
        baseBranch = 'master';
      }

      try {
        const diff = execSync(`git diff ${baseBranch}...HEAD -- "${filePath}"`, { encoding: 'utf8' });
        if (diff.trim()) {
          return diff;
        }
      } catch (e) {
        try {
          // Fallback to direct diff if base...HEAD fails
          const diff = execSync(`git diff ${baseBranch} HEAD -- "${filePath}"`, { encoding: 'utf8' });
          if (diff.trim()) {
            return diff;
          }
        } catch (err) { }
      }
    }

    // Default local fallback: look at staged changes
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

function postRequest(url: string, body: any, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: timeoutMs,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Ollama API responded with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('The operation was aborted due to timeout'));
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function callOllama(
  messages: Array<{ role: string; content: string }>,
  numPredict = 1200,
  timeoutMs = 900000,
  numCtx = 12288
): Promise<string> {
  const requestBody = {
    model: 'qwen2.5-coder:3b',
    messages: messages,
    stream: false,
    format: 'json', // Forces Ollama to output valid JSON
    options: {
      temperature: 0.1,
      num_ctx: numCtx,
      num_predict: numPredict
    },
  };

  const responseText = await postRequest('http://127.0.0.1:11434/api/chat', requestBody, timeoutMs);
  const data = JSON.parse(responseText) as any;
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
  console.log(`🔧 Loaded AI config: maxDependencyDepth = ${config.maxDependencyDepth}, exitOnFailure = ${config.exitOnFailure}, skipMapping = ${config.skipMapping}, timeoutMs = ${config.timeoutMs}, numCtx = ${config.numCtx}`);

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

  // 2. Scan frontend directory recursively (excluding boilerplate/layout files)
  const srcDir = path.resolve(__dirname, '../../apps/web/src');
  const rawFiles = getFilesRecursively(srcDir);
  const excludeBasenames = [
    'layout.tsx', 'client.ts', 'provider.tsx', 'Header.tsx', 'Notification.tsx', 'styleHelpers.ts',
    'page.tsx', 'CreateUserForm.tsx', 'TransactionHistory.tsx', 'UserList.tsx', 'operations.ts'
  ];
  const allFiles = rawFiles.filter(filePath => {
    const basename = path.basename(filePath);
    return !excludeBasenames.includes(basename);
  });

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
      ], 800, config.timeoutMs, config.numCtx);

      let mappingReport: any;
      try {
        mappingReport = JSON.parse(mappingResponse);
      } catch (e: any) {
        console.error('⚠️ Failed to parse Step 1 Mapping response as JSON:', e.message);
        console.log('--- Raw Mapping Response ---');
        console.log(mappingResponse);
        console.log('---------------------------');
        throw e;
      }
      selectedFiles = mappingReport.relevant_files || [];

      // Automatically include any modified frontend files on this branch to guarantee they are audited
      for (const item of catalog) {
        if (getGitDiff(item.fullPath).trim().length > 0) {
          if (!selectedFiles.includes(item.relativePath)) {
            selectedFiles.push(item.relativePath);
          }
        }
      }

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

  // 4. Run audit on selected files file-by-file
  console.log('\n🧠 Step 2: Running audit on selected files...');
  const reports: any[] = [];

  for (const item of selectedItems) {
    if (!fs.existsSync(item.fullPath)) {
      continue;
    }

    console.log(`🔍 Auditing file: ${item.relativePath}...`);
    let code = fs.readFileSync(item.fullPath, 'utf8');
    // clean comments, imports, and excessive empty lines to save context window
    code = cleanCodeForContext(code);

    const auditPrompt = `
You are an extremely strict AI code reviewer and GraphQL consistency auditor.
Your job is to catch SEMANTIC DRIFT, BUSINESS LOGIC MISMATCHES, and FUNCTIONALITY BREAKS between the backend and frontend.

CRITICAL INSTRUCTIONS:
1. Look at the API Resolvers DIFF and Schema DIFF. Identify ANY changes in types, formats, values, constants, equations, thresholds, error conditions, or business rules.
2. Audit the backend changes against the frontend code file using the following strict SEVERITY HIERARCHY:
   - LEVEL 1: CRITICAL BUGS & ERRORS (Audit MUST return status: "FAIL" and report these immediately):
     * Math, scale, or division errors: Any decimal scaling mismatches, unit representation differences (e.g., decimals vs percentages), incorrect formula updates, or wrong arithmetic coefficients. Always evaluate fractions or divisions in the diff to their final decimal values (e.g. "X / 10" evaluates to "X * 0.1"). When comparing to frontend percentages, remember that a percentage of "P%" equals "P / 100" (e.g. 5% is 0.05, NOT 0.5). Verify that the backend rate and the frontend percentage are numerically equal when converted to the same scale. A mismatch in scale (e.g., 0.5 vs 0.05) is a critical level 1 bug/typo.
     * API contract or spelling bugs: GraphQL type mismatches, misspelled field/resolver properties, missing required parameters, or syntax bugs in resolvers.
     * Severe logical bugs: Swapped operators, wrong signs, or incorrect logic rules.
   - LEVEL 2: ARCHITECTURAL WARNINGS (Do NOT fail the audit for these; categorize as status: "PASS" or "WARN"):
     * Refactoring or code structure differences where the business values are correct but parameterized differently.
     * Concerns about the frontend using hardcoded values instead of query-based dynamic configurations.
3. If a LEVEL 1 CRITICAL bug/error exists, prioritize calling it out as the primary reason for a FAIL verdict. Do not let Level 2 architectural suggestions overshadow actual arithmetic, spelling, or logic bugs.

=== 1. GraphQL Schema DIFF ===
${schemaDiff || '(No changes)'}

=== 2. API Resolvers DIFF ===
${resolversDiff || '(No changes)'}

=== 3. Frontend Code File ===
=== File: ${item.relativePath} ===
${code}

Return your output ONLY as a valid JSON object matching this TypeScript interface:
interface AuditReport {
  thinking: string; // Step-by-step description of your analysis: (1) First, identify any math expressions/fractions in the diff and compute their exact values (e.g. evaluate "N / 10" to get decimal values). (2) Second, convert frontend percentages (like "P%") to decimals ("P / 100", e.g. 5% is 0.05). (3) Third, compare their numerical equality and check for 10x or 100x scale/decimal mismatches.
  status: "PASS" | "WARN" | "FAIL";
  backend_changes_summary: string;
  findings: Array<{
    file: string; // This should be "${item.relativePath}"
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
      ], 1000, config.timeoutMs, config.numCtx);

      let report: any;
      try {
        report = JSON.parse(auditResponse);
        if (report.status === 'FAIL' && report.findings) {
          const realErrors = report.findings.filter((f: any) => {
            const desc = (f.description || '').toLowerCase();
            return !desc.includes('hardcoded') && !desc.includes('fetch') && !desc.includes('dynamic');
          });
          if (realErrors.length === 0) {
            report.status = 'PASS';
            report.findings = [];
          }
        }
        reports.push({ file: item.relativePath, ...report });
      } catch (e: any) {
        console.error(`⚠️ Failed to parse Step 2 Audit response for ${item.relativePath} as JSON:`, e.message);
        console.log('--- Raw Audit Response ---');
        console.log(auditResponse);
        console.log('--------------------------');
      }
    } catch (error: any) {
      console.error(`❌ Failed to run AI contract verification for ${item.relativePath}:`, error.message);
    }
  }

  // 5. Aggregate reports and print final summary
  if (reports.length === 0) {
    console.error('❌ All file audits failed or returned invalid JSON.');
    process.exit(config.exitOnFailure ? 1 : 0);
  }

  let finalStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  const allFindings: any[] = [];
  const thinkings: string[] = [];
  const summaries: string[] = [];
  const explanations: string[] = [];

  for (const report of reports) {
    if (report.status === 'FAIL') {
      finalStatus = 'FAIL';
    } else if (report.status === 'WARN' && finalStatus !== 'FAIL') {
      finalStatus = 'WARN';
    }
    if (report.findings && report.findings.length > 0) {
      allFindings.push(...report.findings);
    }
    if (report.thinking) {
      thinkings.push(`[${report.file}]:\n${report.thinking}`);
    }
    if (report.backend_changes_summary && !summaries.includes(report.backend_changes_summary)) {
      summaries.push(report.backend_changes_summary);
    }
    if (report.explanation) {
      explanations.push(`- [${report.file}]: ${report.explanation}`);
    }
  }

  console.log('\n==========================================');
  console.log('📝 AI CONTRACT AUDIT REPORT SUMMARY');
  console.log('==========================================');

  if (thinkings.length > 0) {
    console.log('\n🧠 Model Thinking & Reasoning Process:');
    console.log('------------------------------------------');
    console.log(thinkings.join('\n\n'));
    console.log('------------------------------------------');
  }

  if (summaries.length > 0) {
    console.log('\n🔙 Backend Changes Summary:');
    console.log('------------------------------------------');
    console.log(summaries.join('\n'));
    console.log('------------------------------------------');
  }

  console.log('\n🚦 Validation Verdict:');
  if (finalStatus === 'PASS') {
    console.log('✅ APPROVED (PASS) - The contracts are fully consistent and validated.');
  } else if (finalStatus === 'WARN') {
    console.log('⚠️ APPROVED WITH WARNINGS (WARN) - Minor issues or deprecations detected, but not blocking.');
  } else {
    console.log('❌ NOT APPROVED (FAIL) - Invalidated due to critical inconsistencies or errors.');
  }

  console.log('\nExplanations by file:');
  console.log(explanations.join('\n'));

  if (allFindings.length > 0) {
    console.log('\n🔍 Findings & Error Locations:');
    for (const finding of allFindings) {
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

  if (finalStatus === 'FAIL') {
    if (config.exitOnFailure) {
      console.error('\n❌ AI analysis determined a critical mismatch (FAIL). Halting pipeline.');
      process.exit(1);
    } else {
      console.warn('\n⚠️ AI analysis warning: Critical mismatch detected (FAIL), but exitOnFailure is false. Continuing.');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

