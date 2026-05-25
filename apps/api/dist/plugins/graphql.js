import mercurius from 'mercurius';
import { typeDefs } from '@pipeline/schema';
import { userResolvers } from '../resolvers/user.js';
export async function registerGraphQL(fastify) {
    await fastify.register(mercurius, {
        schema: typeDefs,
        resolvers: userResolvers, // Cast to any to avoid strict type checks before codegen runs
        graphiql: true,
    });
}
