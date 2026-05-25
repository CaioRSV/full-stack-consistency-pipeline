import { Resolvers } from '../generated/graphql';

const users = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
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
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      return newUser;
    },
  },
};
