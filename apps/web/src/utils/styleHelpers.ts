export interface TierStyle {
  label: string;
  bg: string;
  color: string;
  border: string;
}

export const getTierDetails = (tier: string): TierStyle => {
  switch (tier) {
    case 'BRONZE':
      return {
        label: 'Bronze',
        bg: 'rgba(217, 119, 6, 0.15)',
        color: '#d97706',
        border: 'rgba(217, 119, 6, 0.4)',
      };
    case 'SILVER':
      return {
        label: 'Prata (Silver)',
        bg: 'rgba(148, 163, 184, 0.15)',
        color: '#cbd5e1',
        border: 'rgba(148, 163, 184, 0.4)',
      };
    case 'GOLD':
      return {
        label: 'Ouro (Gold)',
        bg: 'rgba(251, 191, 36, 0.15)',
        color: '#fbbf24',
        border: 'rgba(251, 191, 36, 0.4)',
      };
    case 'PLATINUM':
      return {
        label: 'Platina (Platinum)',
        bg: 'rgba(168, 85, 247, 0.15)',
        color: '#c084fc',
        border: 'rgba(168, 85, 247, 0.4)',
      };
    default:
      return {
        label: tier,
        bg: 'rgba(255, 255, 255, 0.1)',
        color: '#fff',
        border: 'rgba(255, 255, 255, 0.2)',
      };
  }
};

export interface TxTypeStyle {
  label: string;
  bg: string;
  color: string;
  border: string;
}

export const getTxTypeDetails = (type: string): TxTypeStyle => {
  switch (type) {
    case 'TRANSFER':
      return {
        label: 'Transferência',
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        border: 'rgba(239, 68, 68, 0.3)',
      };
    case 'SYSTEM_CREDIT':
      return {
        label: 'Crédito Sistema',
        bg: 'rgba(59, 130, 246, 0.15)',
        color: '#60a5fa',
        border: 'rgba(59, 130, 246, 0.3)',
      };
    case 'TIER_REWARD':
      return {
        label: 'Prêmio de Nível',
        bg: 'rgba(168, 85, 247, 0.2)',
        color: '#c084fc',
        border: 'rgba(168, 85, 247, 0.4)',
      };
    default:
      return {
        label: type,
        bg: 'rgba(255, 255, 255, 0.1)',
        color: '#fff',
        border: 'rgba(255, 255, 255, 0.2)',
      };
  }
};
