/**
 * Description: Renders the transaction simulator form. Provides selectors for sender/receiver, input for transfer amount, and computes live previews of fee percentages, limits, and total costs based on the sender's loyalty tier constraints.
 */
import React from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalSent: number;
  tier: string;
}

interface TransferFormProps {
  users: User[];
  senderId: string;
  setSenderId: (id: string) => void;
  receiverId: string;
  setReceiverId: (id: string) => void;
  transferAmount: string;
  setTransferAmount: (amount: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  transferLoading: boolean;
  activeSender: User | undefined;
  feePercentage: number;
  transferLimit: number;
  enteredAmount: number;
  computedFee: number;
  totalCost: number;
  isOverLimit: boolean;
  isInsufficient: boolean;
}

export function TransferForm({
  users,
  senderId,
  setSenderId,
  receiverId,
  setReceiverId,
  transferAmount,
  setTransferAmount,
  onSubmit,
  transferLoading,
  activeSender,
  feePercentage,
  transferLimit,
  enteredAmount,
  computedFee,
  totalCost,
  isOverLimit,
  isInsufficient,
}: TransferFormProps) {
  return (
    <section className="glass-panel">
      <h2>Simular Transferência (Ledger Engine)</h2>
      <p style={{ marginBottom: '1.25rem' }}>
        Transações propagam taxas dinâmicas e upgrades de nível baseados nas regras do remetente.
      </p>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Remetente (Quem envia e paga taxa)
          </label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>
                {u.name} (Saldo: ${u.balance.toFixed(2)} - {u.tier})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Destinatário (Quem recebe o valor líquido)
          </label>
          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
            }}
          >
            {users
              .filter((u) => u.id !== senderId)
              .map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>
                  {u.name} (Saldo: ${u.balance.toFixed(2)})
                </option>
              ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#94a3b8' }}>
            Valor da Transferência ($)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex: 50.00"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            required
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* dynamic rules simulation UI */}
        {activeSender && enteredAmount > 0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Simulação de Taxas ({activeSender.tier})
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Taxa Aplicada:</span>
              <span style={{ color: feePercentage > 0 ? '#fbbf24' : '#10b981' }}>
                {feePercentage}% (${computedFee.toFixed(2)})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Limite do Nível:</span>
              <span>
                {transferLimit === Infinity
                  ? 'Sem limites'
                  : `$${transferLimit.toFixed(2)} por transação`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ color: '#fff' }}>Custo Total:</span>
              <span style={{ color: isInsufficient ? '#ef4444' : '#fff' }}>
                ${totalCost.toFixed(2)}
              </span>
            </div>

            {isOverLimit && (
              <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                ⚠️ O valor excede o limite individual para o nível {activeSender.tier} ($
                {transferLimit}).
              </div>
            )}
            {isInsufficient && (
              <div style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                ⚠️ Saldo insuficiente na conta de {activeSender.name}.
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={transferLoading || isOverLimit || isInsufficient || !senderId || !receiverId || enteredAmount <= 0}
        >
          {transferLoading ? 'Processando Ledger...' : 'Executar Transferência'}
        </button>
      </form>
    </section>
  );
}
