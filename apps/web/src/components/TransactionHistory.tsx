/**
 * Description: Renders the transaction history table and logs for a selected user account. Lists transfers, reward bonuses, and system credits with directional signs (+/-) and tier-based color formatting.
 */
import React from 'react';
import { ApolloError } from '@apollo/client';
import { getTierDetails, getTxTypeDetails } from '@/utils/styleHelpers';

interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalSent: number;
  tier: string;
}

interface Transaction {
  id: string;
  amount: number;
  fee: number;
  type: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
  };
  receiver: {
    id: string;
    name: string;
  };
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalSent: number;
  tier: string;
  transactions: Transaction[];
}

interface TransactionHistoryProps {
  users: User[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  userData: UserDetails | undefined;
  loading: boolean;
  error: ApolloError | undefined;
}

export function TransactionHistory({
  users,
  selectedUserId,
  onSelectUser,
  userData,
  loading,
  error,
}: TransactionHistoryProps) {
  return (
    <section className="glass-panel">
      <h2>Histórico de Transações</h2>
      
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Histórico de:</span>
        <select
          value={selectedUserId}
          onChange={(e) => onSelectUser(e.target.value)}
          style={{
            width: '100%',
            padding: '0.4rem 0.8rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--card-border)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Carregando histórico...</p>}
      {error && <p style={{ color: '#ef4444' }}>Erro: {error.message}</p>}

      {userData ? (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.2)',
              padding: '0.75rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              border: '1px solid rgba(255,255,255,0.02)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Volume Enviado</span>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>
                ${userData.totalSent.toFixed(2)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Saldo Atual</span>
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                ${userData.balance.toFixed(2)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Fidelidade</span>
              <div style={{ color: getTierDetails(userData.tier).color, fontWeight: 'bold' }}>
                {getTierDetails(userData.tier).label}
              </div>
            </div>
          </div>

          {userData.transactions.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#64748b', textAlign: 'center', padding: '1.5rem 0' }}>
              Nenhuma transação registrada para este usuário.
            </p>
          ) : (
            <div
              style={{
                maxHeight: '350px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingRight: '0.25rem',
              }}
            >
              {[...userData.transactions]
                .reverse()
                .map((tx) => {
                  const badge = getTxTypeDetails(tx.type);
                  const isSender = tx.sender?.id === userData.id;
                  const isReceiver = tx.receiver?.id === userData.id;

                  let txMessage = '';
                  let valColor = '#fff';
                  let valPrefix = '';

                  if (tx.type === 'TRANSFER') {
                    if (isSender) {
                      txMessage = `Enviado para ${tx.receiver.name} (Taxa: $${tx.fee.toFixed(2)})`;
                      valColor = '#f87171';
                      valPrefix = '-';
                    } else if (isReceiver) {
                      txMessage = `Recebido de ${tx.sender.name}`;
                      valColor = '#34d399';
                      valPrefix = '+';
                    }
                  } else if (tx.type === 'SYSTEM_CREDIT') {
                    txMessage = 'Crédito inicial concedido pelo sistema';
                    valColor = '#60a5fa';
                    valPrefix = '+';
                  } else if (tx.type === 'TIER_REWARD') {
                    txMessage = 'Recompensa por promoção de nível (Loyalty Upgrade)';
                    valColor = '#c084fc';
                    valPrefix = '+';
                  }

                  return (
                    <div
                      key={tx.id}
                      style={{
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span
                          style={{
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                          {new Date(tx.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8' }}>{txMessage}</span>
                        <strong style={{ color: valColor, fontSize: '0.95rem' }}>
                          {valPrefix}${tx.amount.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <p>Selecione um usuário para carregar o histórico.</p>
      )}
    </section>
  );
}
