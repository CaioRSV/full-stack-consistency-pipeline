'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER, CREATE_USER } from '../graphql/operations';

export default function Home() {
  const [searchId, setSearchId] = useState('1');
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [createdUser, setCreatedUser] = useState<any>(null);

  // Run the user query with variables
  const { data, loading, error, refetch } = useQuery(GET_USER, {
    variables: { id: searchId },
    skip: !searchId,
    errorPolicy: 'all',
  });

  // Run the create user mutation
  const [createUser, { loading: mutationLoading, error: mutationError }] = useMutation(CREATE_USER);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName || !inputEmail) return;

    try {
      const result = await createUser({
        variables: { name: inputName, email: inputEmail },
      });
      if (result.data?.createUser) {
        setCreatedUser(result.data.createUser);
        setInputName('');
        setInputEmail('');
        refetch(); // Refresh current user search if it matches
      }
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>GraphQL Consistency Pipeline</h1>
        <p>Research tool verifying frontend/backend schema alignment automatically.</p>
        
        <div className="status-indicator">
          <span className={`dot ${error ? 'badge-error' : 'dot-green'}`}></span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {error ? 'Schema Inconsistency or Server Offline' : 'GraphQL Contract Validated'}
          </span>
        </div>
      </header>

      <div className="grid">
        {/* User Search Panel */}
        <section className="glass-panel">
          <h2>Query User (Contract Verification)</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Queries the backend schema for a user. If there is a schema drift (e.g. mismatching fields), this operation will fail validation.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="User ID (e.g., 1)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <button onClick={() => refetch()} style={{ width: 'auto' }}>
              Search
            </button>
          </div>

          {loading && <p>Loading user from API...</p>}
          
          {error && (
            <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <strong>Contract Mismatch / Error:</strong> {error.message}
            </div>
          )}

          {data?.user ? (
            <div className="user-card">
              <p><strong>ID:</strong> {data.user.id}</p>
              <p><strong>Name:</strong> {data.user.name}</p>
              <p><strong>Email:</strong> {data.user.email}</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong>Created At:</strong> {data.user.createdAt}
              </p>
            </div>
          ) : (
            !loading && !error && <p style={{ fontStyle: 'italic' }}>No user found with ID "{searchId}"</p>
          )}
        </section>

        {/* User Mutation Panel */}
        <section className="glass-panel">
          <h2>Mutate User (API Drift Test)</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Create a new User. Strict typing ensures mutation inputs match the GraphQL schema types.
          </p>

          <form onSubmit={handleCreateUser}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                Name
              </label>
              <input
                type="text"
                placeholder="Alice"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                Email
              </label>
              <input
                type="email"
                placeholder="alice@example.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={mutationLoading}>
              {mutationLoading ? 'Executing Mutation...' : 'Create User'}
            </button>
          </form>

          {mutationError && (
            <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
              <strong>Mutation Mismatch:</strong> {mutationError.message}
            </div>
          )}

          {createdUser && (
            <div style={{ marginTop: '1.5rem' }}>
              <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>Successfully Created!</span>
              <div className="user-card">
                <p><strong>ID:</strong> {createdUser.id}</p>
                <p><strong>Name:</strong> {createdUser.name}</p>
                <p><strong>Email:</strong> {createdUser.email}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer style={{ marginTop: '5rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
        <p>CI/CD Consistency pipeline checks schema alignment on push/PR.</p>
      </footer>
    </div>
  );
}
