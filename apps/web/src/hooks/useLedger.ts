import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_USERS,
  GET_USER,
  CREATE_USER,
  TRANSFER_CREDITS,
  ADD_CREDITS,
} from '@/graphql/operations';

export interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useLedger() {
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<string>('1');
  const [senderId, setSenderId] = useState<string>('');
  const [receiverId, setReceiverId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');

  // UI Notification alert
  const [notification, setNotification] = useState<NotificationState | null>(null);

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
  }, [listData, senderId, receiverId]);

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

  return {
    selectedUserForHistory,
    setSelectedUserForHistory,
    senderId,
    setSenderId,
    receiverId,
    setReceiverId,
    transferAmount,
    setTransferAmount,
    inputName,
    setInputName,
    inputEmail,
    setInputEmail,
    notification,
    setNotification,
    listData,
    listLoading,
    listError,
    refetchList,
    userData,
    userLoading,
    userError,
    refetchUser,
    createLoading,
    transferLoading,
    addLoading,
    handleUserSelect,
    showNotification,
    handleCreateUser,
    handleAddCredits,
    handleTransfer,
    activeSender,
    activeReceiver,
    feePercentage,
    transferLimit,
    enteredAmount,
    computedFee,
    totalCost,
    isOverLimit,
    isInsufficient,
    isServerOffline,
  };
}
