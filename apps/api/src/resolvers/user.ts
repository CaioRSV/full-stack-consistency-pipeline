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

// Seed initial transaction logs for the seeded users so they start with some history
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

function checkAndUpgradeTier(user: DbUser): string[] {
  const totalSent = calculateTotalSent(user.id);
  const rewardsLog: string[] = [];

  let targetTier = UserTier.Bronze;
  if (totalSent >= 2000) {
    targetTier = UserTier.Platinum;
  } else if (totalSent >= 500) {
    targetTier = UserTier.Gold;
  } else if (totalSent >= 100) {
    targetTier = UserTier.Silver;
  }

  const tierOrder = [UserTier.Bronze, UserTier.Silver, UserTier.Gold, UserTier.Platinum];
  const currentIdx = tierOrder.indexOf(user.tier);
  const targetIdx = tierOrder.indexOf(targetTier);

  if (targetIdx > currentIdx) {
    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      const tierReached = tierOrder[i];
      let rewardAmount = 0;
      if (tierReached === UserTier.Silver) rewardAmount = 10;
      if (tierReached === UserTier.Gold) rewardAmount = 50;
      if (tierReached === UserTier.Platinum) rewardAmount = 150;

      if (rewardAmount > 0) {
        user.balance = parseFloat((user.balance + rewardAmount).toFixed(2));
        transactions.push({
          id: String(transactions.length + 1),
          senderId: null,
          receiverId: user.id,
          amount: rewardAmount,
          fee: 0,
          type: TransactionType.TierReward,
          createdAt: new Date().toISOString(),
        });
        rewardsLog.push(`Promovido para o nível ${tierReached}! Recompensa de $${rewardAmount} creditada.`);
      }
    }
    user.tier = targetTier;
  }

  return rewardsLog;
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

      // Determinar limites de transferência e taxas baseados no Tier atual do remetente
      let limit = 200;
      let feeRate = 0.05;

      if (sender.tier === UserTier.Silver) {
        limit = 500;
        feeRate = 0.03;
      } else if (sender.tier === UserTier.Gold) {
        limit = 1500;
        feeRate = 0.01;
      } else if (sender.tier === UserTier.Platinum) {
        limit = Infinity;
        feeRate = 0.0;
      }

      if (amount > limit) {
        throw new Error(`Limite de transferência excedido para o nível ${sender.tier}. Limite individual: $${limit}.`);
      }

      const fee = parseFloat((amount * feeRate).toFixed(2));
      const totalCost = amount + fee;

      if (sender.balance < totalCost) {
        throw new Error(`Saldo insuficiente. Valor: $${amount.toFixed(2)} + Taxa: $${fee.toFixed(2)} = $${totalCost.toFixed(2)}. Saldo atual: $${sender.balance.toFixed(2)}.`);
      }

      // Executar a transferência atomicamente
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

      // Atualizar o Tier do remetente com base na nova volumetria de envios
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
