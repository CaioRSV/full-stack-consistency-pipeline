import fastify from 'fastify';
import cors from '@fastify/cors';
import { registerGraphQL } from './plugins/graphql.js';

const server = fastify({ logger: true });

async function main() {
  await server.register(cors, {
    origin: true,
  });

  await registerGraphQL(server);

  server.get('/health', async () => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`API Server listening on port ${port}. Ready to take on requests.`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
