/**
 * Description: Renders the simple registration form at the bottom of the dashboard, letting users input name and email to create a new user profile with default BRONZE tier and $100 starting balance.
 */
import React from 'react';

interface CreateUserFormProps {
  inputName: string;
  setInputName: (name: string) => void;
  inputEmail: string;
  setInputEmail: (email: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  createLoading: boolean;
}

export function CreateUserForm({
  inputName,
  setInputName,
  inputEmail,
  setInputEmail,
  onSubmit,
  createLoading,
}: CreateUserFormProps) {
  return (
    <section className="glass-panel" style={{ marginTop: '2.5rem' }}>
      <h2>Criar Novo Usuário no Sistema</h2>
      <p style={{ marginBottom: '1.5rem' }}>
        Novos usuários são registrados instantaneamente com saldo padrão de $100 no tier BRONZE.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'end' }}>
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
  );
}
