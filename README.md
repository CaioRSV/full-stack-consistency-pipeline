# Full-Stack Consistency Pipeline

Este projeto possui documentação detalhada sobre o estágio atual da branch `main` e a explicação de erros nas branches de teste em português em [DOCUMENTACAO.md](file:///Users/asael/Documents/IF1015/full-stack-consistency-pipeline/DOCUMENTACAO.md).

This is a monorepo setup containing both a frontend (Next.js) and a backend (Fastify + GraphQL). It features an evaluation pipeline that ensures consistency across the stack.

## Setup

First, ensure you have `pnpm` installed. Then, install the dependencies from the root directory:

```bash
pnpm install
```

## Running the Application

You can run the frontend and backend individually, or both at the same time.

### Running Both (Recommended)

To run both the frontend and backend simultaneously in parallel, use the following command from the root directory:

```bash
pnpm dev
```
This will start both applications, allowing them to communicate.

### Running Frontend Only

To run just the Next.js frontend (Web app):

```bash
pnpm --filter "@pipeline/web" dev
```
The frontend typically runs on [http://localhost:3000](http://localhost:3000).

### Running Backend Only

To run just the Fastify GraphQL API:

```bash
pnpm --filter "@pipeline/api" dev
```
Check your backend configuration to see the exact port it runs on.

## Evaluation Pipeline

The evaluation pipeline is designed to check for consistency between the frontend queries and the backend schema. It also incorporates AI-assisted semantic drift detection.

To run the validation pipeline, execute the following command from the root directory:

```bash
pnpm run validate
```

### How the Pipeline Works

The `validate` script (`scripts/validate.ts`) runs through three main steps:

1. **GraphQL Code Generator (`graphql-codegen`)**: Verifies operations against the schema and generates typed code.
2. **TypeScript Compilation Check (`pnpm -r typecheck`)**: Runs across all packages to ensure there are no compilation errors based on the newly generated types.
3. **AI-Assisted Contract Validation**: Runs an AI model (Qwen2.5-Coder 3B) via `scripts/ai/semantic-drift-detection.ts` to detect any semantic drift or inconsistencies that static typing might miss.

If all steps pass, the frontend and backend contracts are considered aligned!
