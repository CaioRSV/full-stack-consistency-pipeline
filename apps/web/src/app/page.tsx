'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_USER, CREATE_USER, GET_USERS } from '../graphql/operations';
import { User } from '../graphql/generated/graphql';

export default function Home() {
  const [searchId, setSearchId] = useState('1');
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  // 1. Fetch all users to display list
  const { data: listData, loading: listLoading, error: listError, refetch: refetchList } = useQuery(GET_USERS);

  // 2. Search single user by ID
  const { data: searchData, loading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery(GET_USER, {
    variables: { id: searchId },
    skip: !searchId,
    errorPolicy: 'all',
  });

  // 3. Create user mutation
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
        
        // Refetch active users list and search query
        refetchList();
        refetchSearch();
      }
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  const isServerOffline = listError || searchError;

  return (
    <div className="container">
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1>GraphQL Consistency Pipeline</h1>
        <p>Research tool verifying frontend/backend schema alignment automatically.</p>
        
        <div className="status-indicator">
          <span className={`dot ${isServerOffline ? 'badge-error' : 'dot-green'}`}></span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {isServerOffline ? 'Schema Inconsistency or Server Offline' : 'GraphQL Contract Validated'}
          </span>
        </div>
      </header>

      {/* 1. Full System Users List */}
      <section className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h2>System Users List</h2>
        <p style={{ marginBottom: '1.5rem' }}>
          Real-time query output showing all registered users on the backend server.
        </p>

        {listLoading && <p>Loading users...</p>}
        {listError && (
          <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px' }}>
            <strong>Query Error:</strong> {listError.message}
          </div>
        )}

        {listData?.users && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}>
            {listData.users.map((user: User) => (
              <div key={user.id} className="user-card" style={{ marginBottom: 0 }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User ID: #{user.id}
                </p>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', margin: '0.2rem 0' }}>
                  {user.name}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  {user.email}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.8rem' }}>
                  Joined: {new Date(user.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid">
        {/* 2. User Search Panel */}
        <section className="glass-panel">
          <h2>Query User By ID</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Queries specific user records. Mismatching schema structure will trigger build-time or runtime exceptions.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="User ID (e.g., 1)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <button onClick={() => refetchSearch()} style={{ width: 'auto' }}>
              Search
            </button>
          </div>

          {searchLoading && <p>Loading user details...</p>}
          
          {searchError && (
            <div className="badge badge-error" style={{ width: '100%', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <strong>Contract Mismatch / Error:</strong> {searchError.message}
            </div>
          )}

          {searchData?.user ? (
            <div className="user-card">
              <p><strong>ID:</strong> {searchData.user.id}</p>
              <p><strong>Name:</strong> {searchData.user.name}</p>
              <p><strong>Email:</strong> {searchData.user.email}</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong>Created At:</strong> {searchData.user.createdAt}
              </p>
            </div>
          ) : (
            !searchLoading && !searchError && <p style={{ fontStyle: 'italic' }}>No user found with ID &quot;{searchId}&quot;</p>
          )}
        </section>

        {/* 3. User Mutation Panel */}
        <section className="glass-panel">
          <h2>Create New User</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Adds a new User to the backend database. Updates the users list dynamically upon successful insertion.
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
