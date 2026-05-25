'use client';

import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './client';

export function GraphQLProvider({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
