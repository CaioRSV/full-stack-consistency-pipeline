import { Resolvers } from '../generated/graphql.js';

const users = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    website: 'https://alice.dev',
    bio: 'Software engineer and open source contributor.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    website: 'https://bobsmith.com',
    bio: 'Product manager and designer.',
    createdAt: '2026-02-15T00:00:00.000Z',
  },
];

export const userResolvers: Resolvers = {
  Query: {
    user: async (_parent, { id }) => {
      return users.find((u) => u.id === id) || null;
    },
    users: async () => {
      return users;
    },
  },
  Mutation: {
    createUser: async (_parent, { name, email }) => {
      const newUser = {
        id: String(users.length + 1),
        name,
        email,
        website: 'https://example.com/newuser',
        bio: 'Hello world! I am a new user.',
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      return newUser;
    },
  },
};
