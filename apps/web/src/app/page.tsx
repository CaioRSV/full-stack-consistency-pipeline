'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_USERS,
  GET_USER,
  CREATE_USER,
  TRANSFER_CREDITS,
  ADD_CREDITS,
} from '../graphql/operations';

export default function Home() {
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<string>('1');
  const [senderId, setSenderId] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');

  // UI Notification alert
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // 1. Fetch all users
  const {
    data: listData,
    loading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useQuery(GET_USERS);

  // 2. Fetch selected user history details
  const {
    data: userData,
    loading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery(GET_USER, {
    variables: { id: selectedUserForHistory },
    skip: !selectedUserForHistory,
  });

  // Mutations
  const [createUser, { loading: createLoading }] = useMutation(CREATE_USER);
  const [transferCredits, { loading: transferLoading }] = useMutation(TRANSFER_CREDITS);
  const [addCredits, { loading: addLoading }] = useMutation(ADD_CREDITS);

  // Auto-initialize sender and receiver selectors once users list is available
  useEffect(() => {
    if (listData?.users && listData.users.length > 0) {
      if (!senderId) {
        setSenderId(listData.users[0].id);
      }
      if (!receiverId) {
        // Default receiver to the second user if exists, or the first
        setReceiverId(listData.users[1]?.id || listData.users[0].id);
      }
    }
  }, [listData]);

  // Assist with updating history if a change affects the active user
  const handleUserSelect = (id: string) => {
    setSelectedUserForHistory(id);
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 7000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName || !inputEmail) return;

    try {
      const result = await createUser({
        variables: { name: inputName, email: inputEmail },
      });
      if (result.data?.createUser) {
        showNotification(
          `Usuário ${result.data.createUser.name} criado com sucesso! Ganhou $100 iniciais no Tier BRONZE.`,
          'success'
        );
        setInputName('');
        setInputEmail('');
        refetchList();
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleAddCredits = async (userId: string, amount: number) => {
    try {
      const result = await addCredits({
        variables: { userId, amount },
      });
      if (result.data?.addCredits) {
        showNotification(
          `Crédito adicional de $${amount} adicionado com sucesso para ${result.data.addCredits.name}!`,
          'success'
        );
        refetchList();
        if (userId === selectedUserForHistory) {
          refetchUser();
        }
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!senderId || !receiverId || isNaN(amount) || amount <= 0) {
      showNotification('Preencha os dados e valor corretamente.', 'error');
      return;
    }

    try {
      const result = await transferCredits({
        variables: { senderId, receiverId, amount },
      });

      if (result.data?.transferCredits) {
        const tx = result.data.transferCredits;
        const senderAfter = tx.sender;

        // Refetch state
        await refetchList();
        await refetchUser();

        // Check if there was a tier upgrade by comparing with state
        const senderBefore = listData?.users?.find((u: any) => u.id === senderId);
        let msg = `Transferência de $${amount.toFixed(2)} enviada! Taxa: $${tx.fee.toFixed(2)}.`;

        if (senderBefore && senderAfter && senderBefore.tier !== senderAfter.tier) {
          msg += ` 🏆 O nível de ${senderAfter.name} subiu de ${senderBefore.tier} para ${senderAfter.tier}! Recompensa creditada!`;
          showNotification(msg, 'success');
        } else {
          showNotification(msg, 'success');
        }

        setTransferAmount('');
      }
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Find active users details for live calculations in the form
  const activeSender = listData?.users?.find((u: any) => u.id === senderId);
  const activeReceiver = listData?.users?.find((u: any) => u.id === receiverId);

  // Live rules preview based on sender's tier
  let feePercentage = 5;
  let transferLimit = 200;
  if (activeSender) {
    if (activeSender.tier === 'SILVER') {
      feePercentage = 3;
      transferLimit = 500;
    } else if (activeSender.tier === 'GOLD') {
      feePercentage = 1;
      transferLimit = 1500;
    } else if (activeSender.tier === 'PLATINUM') {
      feePercentage = 0;
      transferLimit = Infinity;
    }
  }

  const enteredAmount = parseFloat(transferAmount) || 0;
  const computedFee = parseFloat((enteredAmount * (feePercentage / 100)).toFixed(2));
  const totalCost = parseFloat((enteredAmount + computedFee).toFixed(2));

  const isOverLimit = enteredAmount > transferLimit;
  const isInsufficient = activeSender ? activeSender.balance < totalCost : false;

  const isServerOffline = !!(listError || userError);

  // Styling maps for Tiers
  const getTierDetails = (tier: string) => {
    switch (tier) {
      case 'BRONZE':
        return {
          label: 'Bronze',
          bg: 'rgba(217, 119, 6, 0.15)',
          color: '#d97706',
          border: 'rgba(217, 119, 6, 0.4)',
        };
      case 'SILVER':
        return {
          label: 'Prata (Silver)',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.4)',
        };
      case 'GOLD':
        return {
          label: 'Ouro (Gold)',
          bg: 'rgba(251, 191, 36, 0.15)',
          color: '#fbbf24',
          border: 'rgba(251, 191, 36, 0.4)',
        };
      case 'PLATINUM':
        return {
          label: 'Platina (Platinum)',
          bg: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: 'rgba(168, 85, 247, 0.4)',
        };
      default:
        return {
          label: tier,
          bg: 'rgba(255, 255, 255, 0.1)',
          color: '#fff',
          border: 'rgba(255, 255, 255, 0.2)',
        };
    }
  };

  // Transaction type badges details
  const getTxTypeDetails = (type: string) => {
    switch (type) {
      case 'TRANSFER':
        return {
          label: 'Transferência',
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: 'rgba(239, 68, 68, 0.3)',
        };
      case 'SYSTEM_CREDIT':
        return {
          label: 'Crédito Sistema',
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: 'rgba(59, 130, 246, 0.3)',
        };
      case 'TIER_REWARD':
        return {
          label: 'Prêmio de Nível',
          bg: 'rgba(168, 85, 247, 0.2)',
          color: '#c084fc',
          border: 'rgba(168, 85, 247, 0.4)',
        };
      default:
        return {
          label: type,
          bg: 'rgba(255, 255, 255, 0.1)',
          color: '#fff',
          border: 'rgba(255, 255, 255, 0.2)',
        };
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1>GraphQL Consistency Ledger & Tiers</h1>
        <p>
          Simulação de fluxo financeiro consistente e progressão de fidelidade automatizada.
        </p>

        <div className="status-indicator">
          <span className={`dot ${isServerOffline ? 'badge-error' : 'dot-green'}`}></span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {isServerOffline ? 'Erro de Schema ou Servidor Offline' : 'GraphQL API Conectada & Válida'}
          </span>
        </div>
      </header>

      {/* Floating alert notifications */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            padding: '1.25rem 2rem',
            borderRadius: '12px',
            maxWidth: '450px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            border: '1px solid',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease',
            backgroundColor:
              notification.type === 'success'
                ? 'rgba(16, 185, 129, 0.9)'
                : notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.9)'
                : 'rgba(59, 130, 246, 0.9)',
            borderColor:
              notification.type === 'success'
                ? '#10b981'
                : notification.type === 'error'
                ? '#ef4444'
                : '#3b82f6',
            color: '#fff',
          }}
        >
          <strong>{notification.type === 'success' ? 'Sucesso!' : notification.type === 'error' ? 'Erro' : 'Info'}:</strong>{' '}
          {notification.message}
        </div>
      )}

      {/* 1. users list cards layout */}
      <section className="glass-panel" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2>Usuários do Sistema (Contas & Carteiras)</h2>
            <p>Selecione um usuário para visualizar o histórico detalhado de transações.</p>
          </div>
          <button
            onClick={() => refetchList()}
            style={{ width: 'auto', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Atualizar Lista
          </button>
        </div>

        {listLoading && <p>Carregando carteiras...</p>}
        {listError && (
          <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px' }}>
            <strong>Erro na consulta de usuários:</strong> {listError.message}
          </div>
        )}

        {listData?.users && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.25rem',
              marginTop: '1rem',
            }}
          >
            {listData.users.map((u: any) => {
              const tierInfo = getTierDetails(u.tier);
              const isSelected = selectedUserForHistory === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => handleUserSelect(u.id)}
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
                      onClick={() => handleAddCredits(u.id, 50.0)}
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
                      onClick={() => handleAddCredits(u.id, 200.0)}
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

      {/* Grid: transfer Tool and transaction logs */}
      <div className="grid">
        {/* Left Form: transfer credits */}
        <section className="glass-panel">
          <h2>Simular Transferência (Ledger Engine)</h2>
          <p style={{ marginBottom: '1.25rem' }}>
            Transações propagam taxas dinâmicas e upgrades de nível baseados nas regras do remetente.
          </p>

          <form onSubmit={handleTransfer}>
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
                {listData?.users?.map((u: any) => (
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
                {listData?.users
                  ?.filter((u: any) => u.id !== senderId)
                  ?.map((u: any) => (
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

        {/* Right Form: user transactions list */}
        <section className="glass-panel">
          <h2>Histórico de Transações</h2>
          
          <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Histórico de:</span>
            <select
              value={selectedUserForHistory}
              onChange={(e) => handleUserSelect(e.target.value)}
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
              {listData?.users?.map((u: any) => (
                <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {userLoading && <p>Carregando histórico...</p>}
          {userError && <p style={{ color: '#ef4444' }}>Erro: {userError.message}</p>}

          {userData?.user ? (
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
                    ${userData.user.totalSent.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Saldo Atual</span>
                  <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                    ${userData.user.balance.toFixed(2)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Fidelidade</span>
                  <div style={{ color: getTierDetails(userData.user.tier).color, fontWeight: 'bold' }}>
                    {getTierDetails(userData.user.tier).label}
                  </div>
                </div>
              </div>

              {userData.user.transactions.length === 0 ? (
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
                  {[...userData.user.transactions]
                    .reverse()
                    .map((tx: any) => {
                      const badge = getTxTypeDetails(tx.type);
                      const isSender = tx.sender?.id === userData.user.id;
                      const isReceiver = tx.receiver?.id === userData.user.id;

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
      </div>

      {/* 3. Create User Panel */}
      <section className="glass-panel" style={{ marginTop: '2.5rem' }}>
        <h2>Criar Novo Usuário no Sistema</h2>
        <p style={{ marginBottom: '1.5rem' }}>
          Novos usuários são registrados instantaneamente com saldo padrão de $100 no tier BRONZE.
        </p>

        <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
              Nome Completo
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos Santos"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
              Endereço de E-mail
            </label>
            <input
              type="email"
              placeholder="carlos@exemplo.com"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>

          <button type="submit" disabled={createLoading} style={{ height: '42px' }}>
            {createLoading ? 'Criando usuário...' : 'Registrar Usuário'}
          </button>
        </form>
      </section>

      <footer style={{ marginTop: '4rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
        <p>GraphQL Consistency pipeline guarantees type-safety across client & server.</p>
      </footer>
    </div>
  );
}
