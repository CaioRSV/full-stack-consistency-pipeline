import { FastifyInstance } from 'fastify';
import mercurius from 'mercurius';
import { typeDefs } from '@pipeline/schema';
import { userResolvers } from '../resolvers/user.js';

export async function registerGraphQL(fastify: FastifyInstance) {
  await fastify.register(mercurius, {
    schema: typeDefs,
    resolvers: userResolvers as any, // Cast to any to avoid strict type checks before codegen runs
    graphiql: true,
  });
}
