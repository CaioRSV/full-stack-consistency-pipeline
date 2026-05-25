import { Resolvers, UserTier, TransactionType } from '../generated/graphql.js';

interface DbUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  balance: number;
  tier: UserTier;
}

interface DbTransaction {
  id: string;
  senderId: string | null;
  receiverId: string;
  amount: number;
  fee: number;
  type: TransactionType;
  createdAt: string;
}

// ---------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for all tier business rules.
// Any change here is automatically picked up by:
//   1. The resolvers (validation, fee calculation, tier upgrades)
//   2. The frontend via the `tierSettings` GraphQL query
// ---------------------------------------------------------------
const TIER_CONFIGS = [
  {
    tier: UserTier.Bronze,
    transactionLimit: 200.0,
    feePercentage: 5.0,
    minSentVolume: 0.0,
    upgradeReward: 0.0,
  },
  {
    tier: UserTier.Silver,
    transactionLimit: 500.0,
    feePercentage: 3.0,
    minSentVolume: 100.0,
    upgradeReward: 10.0,
  },
  {
    tier: UserTier.Gold,
    transactionLimit: 1500.0,
    feePercentage: 1.0,
    minSentVolume: 500.0,
    upgradeReward: 50.0,
  },
  {
    tier: UserTier.Platinum,
    transactionLimit: 999999.0,
    feePercentage: 0.0,
    minSentVolume: 2000.0,
    upgradeReward: 150.0,
  },
];

function getConfig(tier: UserTier) {
  return TIER_CONFIGS.find((c) => c.tier === tier)!;
}

const users: DbUser[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    balance: 100.0,
    tier: UserTier.Bronze,
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    createdAt: '2026-02-15T00:00:00.000Z',
    balance: 100.0,
    tier: UserTier.Bronze,
  },
];

const transactions: DbTransaction[] = [];

// Seed initial system credits for the seeded users
transactions.push(
  {
    id: '1',
    senderId: null,
    receiverId: '1',
    amount: 100.0,
    fee: 0,
    type: TransactionType.SystemCredit,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    senderId: null,
    receiverId: '2',
    amount: 100.0,
    fee: 0,
    type: TransactionType.SystemCredit,
    createdAt: '2026-02-15T00:00:00.000Z',
  }
);

function calculateTotalSent(userId: string): number {
  return transactions
    .filter((t) => t.senderId === userId && t.type === TransactionType.Transfer)
    .reduce((sum, t) => sum + t.amount, 0);
}

function checkAndUpgradeTier(user: DbUser): void {
  const totalSent = calculateTotalSent(user.id);

  // Determine target tier based on TIER_CONFIGS thresholds (descending)
  const sortedTiers = [...TIER_CONFIGS].sort((a, b) => b.minSentVolume - a.minSentVolume);
  const targetConfig = sortedTiers.find((c) => totalSent >= c.minSentVolume)!;
  const targetTier = targetConfig.tier;

  const tierOrder = TIER_CONFIGS.map((c) => c.tier);
  const currentIdx = tierOrder.indexOf(user.tier);
  const targetIdx = tierOrder.indexOf(targetTier);

  if (targetIdx > currentIdx) {
    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      const tierReached = tierOrder[i];
      const cfg = getConfig(tierReached);

      if (cfg.upgradeReward > 0) {
        user.balance = parseFloat((user.balance + cfg.upgradeReward).toFixed(2));
        transactions.push({
          id: String(transactions.length + 1),
          senderId: null,
          receiverId: user.id,
          amount: cfg.upgradeReward,
          fee: 0,
          type: TransactionType.TierReward,
          createdAt: new Date().toISOString(),
        });
      }
    }
    user.tier = targetTier;
  }
}

export const userResolvers: Resolvers = {
  Query: {
    user: async (_parent, { id }) => {
      return (users.find((u) => u.id === id) as any) || null;
    },
    users: async () => {
      return users as any;
    },
    transactions: async () => {
      return transactions as any;
    },
    tierSettings: async () => {
      return TIER_CONFIGS;
    },
  },
  Mutation: {
    createUser: async (_parent, { name, email }) => {
      const newUser: DbUser = {
        id: String(users.length + 1),
        name,
        email,
        createdAt: new Date().toISOString(),
        balance: 100.0,
        tier: UserTier.Bronze,
      };
      users.push(newUser);

      transactions.push({
        id: String(transactions.length + 1),
        senderId: null,
        receiverId: newUser.id,
        amount: 100.0,
        fee: 0,
        type: TransactionType.SystemCredit,
        createdAt: new Date().toISOString(),
      });

      return newUser as any;
    },
    transferCredits: async (_parent, { senderId, receiverId, amount }) => {
      if (amount <= 0) {
        throw new Error('O valor da transferência deve ser maior que zero.');
      }
      if (senderId === receiverId) {
        throw new Error('Não é possível transferir para si mesmo.');
      }

      const sender = users.find((u) => u.id === senderId);
      const receiver = users.find((u) => u.id === receiverId);

      if (!sender) throw new Error('Remetente não encontrado.');
      if (!receiver) throw new Error('Destinatário não encontrado.');

      // Use TIER_CONFIGS as the single source of truth — not hardcoded conditionals
      const cfg = getConfig(sender.tier);
      const limit = cfg.transactionLimit;
      const feeRate = cfg.feePercentage / 100;

      if (amount > limit) {
        throw new Error(
          `Limite de transferência excedido para o nível ${sender.tier}. Limite individual: $${limit.toFixed(2)}.`
        );
      }

      const fee = parseFloat((amount * feeRate).toFixed(2));
      const totalCost = amount + fee;

      if (sender.balance < totalCost) {
        throw new Error(
          `Saldo insuficiente. Valor: $${amount.toFixed(2)} + Taxa: $${fee.toFixed(2)} = $${totalCost.toFixed(2)}. Saldo atual: $${sender.balance.toFixed(2)}.`
        );
      }

      sender.balance = parseFloat((sender.balance - totalCost).toFixed(2));
      receiver.balance = parseFloat((receiver.balance + amount).toFixed(2));

      const newTx: DbTransaction = {
        id: String(transactions.length + 1),
        senderId,
        receiverId,
        amount,
        fee,
        type: TransactionType.Transfer,
        createdAt: new Date().toISOString(),
      };
      transactions.push(newTx);

      checkAndUpgradeTier(sender);

      return newTx as any;
    },
    addCredits: async (_parent, { userId, amount }) => {
      if (amount <= 0) {
        throw new Error('O valor do crédito deve ser maior que zero.');
      }
      const user = users.find((u) => u.id === userId);
      if (!user) throw new Error('Usuário não encontrado.');

      user.balance = parseFloat((user.balance + amount).toFixed(2));

      transactions.push({
        id: String(transactions.length + 1),
        senderId: null,
        receiverId: userId,
        amount,
        fee: 0,
        type: TransactionType.SystemCredit,
        createdAt: new Date().toISOString(),
      });

      return user as any;
    },
  },
  User: {
    transactions: (parent) => {
      return transactions.filter(
        (t) => t.senderId === parent.id || t.receiverId === parent.id
      ) as any;
    },
    totalSent: (parent) => {
      return calculateTotalSent(parent.id);
    },
  },
  Transaction: {
    sender: (parent: any) => {
      if (!parent.senderId) return null;
      return (users.find((u) => u.id === parent.senderId) as any) || null;
    },
    receiver: (parent: any) => {
      return (users.find((u) => u.id === parent.receiverId) as any)!;
    },
  },
};
