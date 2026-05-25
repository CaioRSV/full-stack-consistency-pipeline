/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetUser($id: ID!) {\n    user(id: $id) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n      transactions {\n        id\n        amount\n        fee\n        type\n        createdAt\n        sender {\n          id\n          name\n        }\n        receiver {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.GetUserDocument,
    "\n  mutation CreateUser($name: String!, $email: String!) {\n    createUser(name: $name, email: $email) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n    }\n  }\n": typeof types.CreateUserDocument,
    "\n  query GetUsers {\n    users {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n    }\n  }\n": typeof types.GetUsersDocument,
    "\n  mutation TransferCredits($senderId: ID!, $receiverId: ID!, $amount: Float!) {\n    transferCredits(senderId: $senderId, receiverId: $receiverId, amount: $amount) {\n      id\n      amount\n      fee\n      type\n      createdAt\n      sender {\n        id\n        name\n        balance\n        tier\n      }\n      receiver {\n        id\n        name\n        balance\n      }\n    }\n  }\n": typeof types.TransferCreditsDocument,
    "\n  mutation AddCredits($userId: ID!, $amount: Float!) {\n    addCredits(userId: $userId, amount: $amount) {\n      id\n      name\n      balance\n      tier\n    }\n  }\n": typeof types.AddCreditsDocument,
    "\n  query GetTierSettings {\n    tierSettings {\n      tier\n      transactionLimit\n      feePercentage\n      minSentVolume\n      upgradeReward\n    }\n  }\n": typeof types.GetTierSettingsDocument,
};
const documents: Documents = {
    "\n  query GetUser($id: ID!) {\n    user(id: $id) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n      transactions {\n        id\n        amount\n        fee\n        type\n        createdAt\n        sender {\n          id\n          name\n        }\n        receiver {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.GetUserDocument,
    "\n  mutation CreateUser($name: String!, $email: String!) {\n    createUser(name: $name, email: $email) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n    }\n  }\n": types.CreateUserDocument,
    "\n  query GetUsers {\n    users {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n    }\n  }\n": types.GetUsersDocument,
    "\n  mutation TransferCredits($senderId: ID!, $receiverId: ID!, $amount: Float!) {\n    transferCredits(senderId: $senderId, receiverId: $receiverId, amount: $amount) {\n      id\n      amount\n      fee\n      type\n      createdAt\n      sender {\n        id\n        name\n        balance\n        tier\n      }\n      receiver {\n        id\n        name\n        balance\n      }\n    }\n  }\n": types.TransferCreditsDocument,
    "\n  mutation AddCredits($userId: ID!, $amount: Float!) {\n    addCredits(userId: $userId, amount: $amount) {\n      id\n      name\n      balance\n      tier\n    }\n  }\n": types.AddCreditsDocument,
    "\n  query GetTierSettings {\n    tierSettings {\n      tier\n      transactionLimit\n      feePercentage\n      minSentVolume\n      upgradeReward\n    }\n  }\n": types.GetTierSettingsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUser($id: ID!) {\n    user(id: $id) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n      transactions {\n        id\n        amount\n        fee\n        type\n        createdAt\n        sender {\n          id\n          name\n        }\n        receiver {\n          id\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetUser($id: ID!) {\n    user(id: $id) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n      transactions {\n        id\n        amount\n        fee\n        type\n        createdAt\n        sender {\n          id\n          name\n        }\n        receiver {\n          id\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateUser($name: String!, $email: String!) {\n    createUser(name: $name, email: $email) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n    }\n  }\n"): (typeof documents)["\n  mutation CreateUser($name: String!, $email: String!) {\n    createUser(name: $name, email: $email) {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUsers {\n    users {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n    }\n  }\n"): (typeof documents)["\n  query GetUsers {\n    users {\n      id\n      name\n      email\n      createdAt\n      balance\n      tier\n      totalSent\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TransferCredits($senderId: ID!, $receiverId: ID!, $amount: Float!) {\n    transferCredits(senderId: $senderId, receiverId: $receiverId, amount: $amount) {\n      id\n      amount\n      fee\n      type\n      createdAt\n      sender {\n        id\n        name\n        balance\n        tier\n      }\n      receiver {\n        id\n        name\n        balance\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation TransferCredits($senderId: ID!, $receiverId: ID!, $amount: Float!) {\n    transferCredits(senderId: $senderId, receiverId: $receiverId, amount: $amount) {\n      id\n      amount\n      fee\n      type\n      createdAt\n      sender {\n        id\n        name\n        balance\n        tier\n      }\n      receiver {\n        id\n        name\n        balance\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AddCredits($userId: ID!, $amount: Float!) {\n    addCredits(userId: $userId, amount: $amount) {\n      id\n      name\n      balance\n      tier\n    }\n  }\n"): (typeof documents)["\n  mutation AddCredits($userId: ID!, $amount: Float!) {\n    addCredits(userId: $userId, amount: $amount) {\n      id\n      name\n      balance\n      tier\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetTierSettings {\n    tierSettings {\n      tier\n      transactionLimit\n      feePercentage\n      minSentVolume\n      upgradeReward\n    }\n  }\n"): (typeof documents)["\n  query GetTierSettings {\n    tierSettings {\n      tier\n      transactionLimit\n      feePercentage\n      minSentVolume\n      upgradeReward\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;