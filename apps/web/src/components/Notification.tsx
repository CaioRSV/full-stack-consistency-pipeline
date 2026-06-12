/**
 * Description: Renders absolute positioned floating pop-up/toast notification banners displaying status alerts (e.g. success, error, info) for ledger updates.
 */
import React from 'react';
import { NotificationState } from '@/hooks/useLedger';

interface NotificationProps {
  notification: NotificationState | null;
}

export function Notification({ notification }: NotificationProps) {
  if (!notification) return null;

  return (
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
      <strong>
        {notification.type === 'success' ? 'Sucesso!' : notification.type === 'error' ? 'Erro' : 'Info'}:
      </strong>{' '}
      {notification.message}
    </div>
  );
}
