import React from 'react';

interface HeaderProps {
  isServerOffline: boolean;
}

export function Header({ isServerOffline }: HeaderProps) {
  return (
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
  );
}
