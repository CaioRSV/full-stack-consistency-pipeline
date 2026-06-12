/**
 * Description: The main orchestrator and layout page for the Web app Dashboard. Integrates components for User List, Transfer simulator, transaction history logs, and user creation form, linking them to useLedger state.
 */
'use client';

import React from 'react';
import { useLedger } from '@/hooks/useLedger';
import { Header } from '@/components/Header';
import { Notification } from '@/components/Notification';
import { UserList } from '@/components/UserList';
import { TransferForm } from '@/components/TransferForm';
import { TransactionHistory } from '@/components/TransactionHistory';
import { CreateUserForm } from '@/components/CreateUserForm';

export default function Home() {
  const ledger = useLedger();

  return (
    <div className="container">
      <Header isServerOffline={ledger.isServerOffline} />
      <Notification notification={ledger.notification} />

      <UserList
        users={ledger.listData?.users || []}
        loading={ledger.listLoading}
        error={ledger.listError}
        selectedUserId={ledger.selectedUserForHistory}
        onSelectUser={ledger.handleUserSelect}
        onAddCredits={ledger.handleAddCredits}
        addLoading={ledger.addLoading}
        onRefetchList={ledger.refetchList}
      />

      <div className="grid">
        <TransferForm
          users={ledger.listData?.users || []}
          senderId={ledger.senderId}
          setSenderId={ledger.setSenderId}
          receiverId={ledger.receiverId}
          setReceiverId={ledger.setReceiverId}
          transferAmount={ledger.transferAmount}
          setTransferAmount={ledger.setTransferAmount}
          onSubmit={ledger.handleTransfer}
          transferLoading={ledger.transferLoading}
          activeSender={ledger.activeSender}
          feePercentage={ledger.feePercentage}
          transferLimit={ledger.transferLimit}
          enteredAmount={ledger.enteredAmount}
          computedFee={ledger.computedFee}
          totalCost={ledger.totalCost}
          isOverLimit={ledger.isOverLimit}
          isInsufficient={ledger.isInsufficient}
        />

        <TransactionHistory
          users={ledger.listData?.users || []}
          selectedUserId={ledger.selectedUserForHistory}
          onSelectUser={ledger.handleUserSelect}
          userData={ledger.userData?.user}
          loading={ledger.userLoading}
          error={ledger.userError}
        />
      </div>

      <CreateUserForm
        inputName={ledger.inputName}
        setInputName={ledger.setInputName}
        inputEmail={ledger.inputEmail}
        setInputEmail={ledger.setInputEmail}
        onSubmit={ledger.handleCreateUser}
        createLoading={ledger.createLoading}
      />

      <footer style={{ marginTop: '4rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
        <p>GraphQL Consistency pipeline guarantees type-safety across client & server.</p>
      </footer>
    </div>
  );
}
