import { execSync } from 'child_process';

console.log('🏁 Starting GraphQL Consistency Validation Pipeline...');

try {
  console.log('\n🔄 1. Running GraphQL Code Generator (Verifying operations against schema)...');
  execSync('npx graphql-codegen --config codegen.ts', { stdio: 'inherit' });
  console.log('✅ GraphQL Code Generator validation passed.');

  console.log('\n🔍 2. Running TypeScript Compilation Check across all packages...');
  execSync('npx pnpm -r typecheck', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation validation passed.');

  console.log('\n🤖 3. Running AI-Assisted Contract Validation (Qwen2.5-Coder 3B)...');
  execSync('npx ts-node scripts/ai/semantic-drift-detection.ts', { stdio: 'inherit' });
  console.log('✅ AI Contract validation completed.');

  console.log('\n🎉 Consistency validation successful! Frontend and Backend contracts are aligned.');
} catch (error) {
  console.error('\n❌ Consistency validation failed! Schema/Query inconsistency or compilation errors detected.');
  process.exit(1);
}
