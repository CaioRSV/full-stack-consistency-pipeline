/**
 * Description: Renders the system accounts grid showing each user's ID, email, current balance, total money sent, and loyalty tier badge. Includes quick buttons to award +$50 or +$200 credit mutations.
 */
import React from 'react';
import { ApolloError } from '@apollo/client';
import { getTierDetails } from '@/utils/styleHelpers';

interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalSent: number;
  tier: string;
}

interface UserListProps {
  users: User[];
  loading: boolean;
  error: ApolloError | undefined;
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  onAddCredits: (userId: string, amount: number) => Promise<void>;
  addLoading: boolean;
  onRefetchList: () => any;
}

export function UserList({
  users,
  loading,
  error,
  selectedUserId,
  onSelectUser,
  onAddCredits,
  addLoading,
  onRefetchList,
}: UserListProps) {
  return (
    <section className="glass-panel" style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h2>Usuários do Sistema (Contas & Carteiras)</h2>
          <p>Selecione um usuário para visualizar o histórico detalhado de transações.</p>
        </div>
        <button
          onClick={() => onRefetchList()}
          style={{ width: 'auto', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          Atualizar Lista
        </button>
      </div>

      {loading && <p>Carregando carteiras...</p>}
      {error && (
        <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px' }}>
          <strong>Erro na consulta de usuários:</strong> {error.message}
        </div>
      )}

      {users && users.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem',
            marginTop: '1rem',
          }}
        >
          {users.map((u) => {
            const tierInfo = getTierDetails(u.tier);
            const isSelected = selectedUserId === u.id;
            return (
              <div
                key={u.id}
                onClick={() => onSelectUser(u.id)}
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.35)',
                  border: isSelected
                    ? '2px solid var(--primary)'
                    : '1px solid var(--card-border)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.25)' : 'none',
                }}
                className="user-card-interactive"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: #{u.id}</span>
                  <span
                    style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: tierInfo.bg,
                      color: tierInfo.color,
                      border: `1px solid ${tierInfo.border}`,
                    }}
                  >
                    {tierInfo.label}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: '0.5rem 0 0.2rem 0' }}>
                  {u.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  {u.email}
                </p>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Saldo:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981', textShadow: '0 0 8px rgba(16, 185, 129, 0.1)' }}>
                      ${u.balance.toFixed(2)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: '#64748b' }}>Enviado:</span>
                    <span style={{ color: '#94a3b8' }}>${u.totalSent.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onAddCredits(u.id, 50.0)}
                    disabled={addLoading}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      background: 'linear-gradient(to right, #10b981, #059669)',
                      boxShadow: 'none',
                    }}
                  >
                    + $50 Crédito
                  </button>
                  <button
                    onClick={() => onAddCredits(u.id, 200.0)}
                    disabled={addLoading}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                      boxShadow: 'none',
                    }}
                  >
                    + $200 Crédito
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
