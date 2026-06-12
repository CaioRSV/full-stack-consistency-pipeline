/**
 * Description: Defines the GraphQL queries and mutations (GET_USER, CREATE_USER, GET_USERS, TRANSFER_CREDITS, ADD_CREDITS) utilized by the frontend hooks and components to communicate with Fastify GraphQL backend.
 */
import { gql } from '@apollo/client';

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      website
      bio
      createdAt
      balance
      tier
      totalSent
      transactions {
        id
        amount
        fee
        type
        createdAt
        sender {
          id
          name
        }
        receiver {
          id
          name
        }
      }
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
      website
      bio
      createdAt
      balance
      tier
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      website
      bio
      createdAt
      balance
      tier
      totalSent
    }
  }
`;

export const TRANSFER_CREDITS = gql`
  mutation TransferCredits($senderId: ID!, $receiverId: ID!, $amount: Float!) {
    transferCredits(senderId: $senderId, receiverId: $receiverId, amount: $amount) {
      id
      amount
      fee
      type
      createdAt
      sender {
        id
        name
        balance
        tier
      }
      receiver {
        id
        name
        balance
      }
    }
  }
`;

export const ADD_CREDITS = gql`
  mutation AddCredits($userId: ID!, $amount: Float!) {
    addCredits(userId: $userId, amount: $amount) {
      id
      name
      balance
      tier
    }
  }
`;
