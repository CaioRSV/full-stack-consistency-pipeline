# Documentação de Consistência e Status do Projeto (Antigravity)

Este documento detalha o estágio de desenvolvimento na branch `main` e o comportamento de teste das duas branches de features (`feature/wallet-loyalty-tiers` e `feature/wallet-dynamic-settings`), que simulam alterações de backend sem quebra de compilação ou lint, mas com erros intencionais de runtime no frontend.

---

## 1. Branch `main` (Estágio Atual do Projeto)

A branch `main` contém a base estável e funcional do sistema de carteira (Wallet) com controle de níveis de fidelidade (Loyalty Tiers).

### Funcionalidades do Backend (`apps/api`)
- **Gestão de Usuários**: Armazenamento em memória de perfis de usuário (`id`, `name`, `email`, `website`, `bio`, `balance`, `tier`).
- **Níveis de Fidelidade (Tiers)**: Quatro níveis distintos (`BRONZE`, `SILVER`, `GOLD`, `PLATINUM`).
- **Transferências com Regras Estáticas**: Limites e taxas de transferência são calculados por condicionais estáticos e fixos (`if`/`else`) baseados no nível do remetente:
  - **BRONZE**: Limite de transferência de `$200.00` por transação e taxa de `5%` (`0.05`).
  - **SILVER**: Limite de transferência de `$500.00` por transação e taxa de `3%` (`0.03`).
  - **GOLD**: Limite de transferência de `$1500.00` por transação e taxa de `1%` (`0.01`).
  - **PLATINUM**: Limite de transferência ilimitado e taxa de `0%`.
- **Sistema de Upgrade de Nível**:
  - Promoção automática baseada no volume total de créditos já enviados (`totalSent`):
    - De `$100` a `$499.99` enviados $\rightarrow$ Upgrade para **SILVER** (recompensa de `$10.00`).
    - De `$500` a `$1999.99` enviados $\rightarrow$ Upgrade para **GOLD** (recompensa de `$50.00`).
    - `$2000` ou mais enviados $\rightarrow$ Upgrade para **PLATINUM** (recompensa de `$150.00`).

### Funcionalidades do Frontend (`apps/web`)
- Dashboard completo de controle para verificar usuários e transferir créditos.
- Listagem dinâmica de usuários com saldo e tier.
- Consulta detalhada de histórico de transações de cada usuário.
- Formulários funcionais para **Criar Novo Usuário**, **Adicionar Crédito** e **Realizar Transferência**.

---

## 2. Branch `feature/wallet-loyalty-tiers`

Essa branch simula um cenário onde alterações na **regra de negócio** no backend passam em todas as verificações automáticas (TypeScript, GraphQL Codegen, etc.), mas introduzem um bug comportamental grave no uso cotidiano.

### Conteúdo da Branch
- Adiciona badges visuais detalhados para exibir os níveis (`BRONZE`, `SILVER`, `GOLD`, `PLATINUM`) diretamente nos cartões de usuários do frontend para melhorar a experiência do usuário com tiers.

### Erro Intencional Introduzido
No arquivo [`apps/api/src/resolvers/user.ts`](file:///Users/asael/Documents/IF1015/full-stack-consistency-pipeline/apps/api/src/resolvers/user.ts), na lógica de transferências para usuários do nível `GOLD`, a taxa foi digitada incorretamente:
```typescript
} else if (sender.tier === UserTier.Gold) {
  limit = 1500;
  feeRate = 1.0; // BUG: Deveria ser 0.01 (1%), mas foi alterado para 1.0 (100%)
}
```

### Motivo e Mecanismo do Erro no Frontend
- **Motivo de passar na Build**: `1.0` é um valor numérico válido (`Float` no schema GraphQL e `number` no TypeScript). Portanto, nem o linter nem o compilador (`tsc --noEmit`) emitem alertas.
- **Como acontece no Frontend (Runtime)**:
  - O usuário `GOLD` tenta realizar uma transferência no valor de `$100.00`.
  - A API calcula a taxa como `$100.00` ($100\%$ do valor). O custo total torna-se `$200.00`.
  - Caso o saldo atual seja de `$100.00`, a operação falhará repentinamente, e o frontend exibirá uma mensagem de erro indicando fundos insuficientes para cobrir a transação + a taxa oculta.
  - Caso o usuário tenha saldo suficiente, metade da sua carteira é consumida imediatamente apenas no pagamento da taxa, gerando perda imediata de saldo sem aviso óbvio de erro.

---

## 3. Branch `feature/wallet-dynamic-settings`

Essa branch elimina regras de negócio duplicadas e codificadas diretamente nas aplicações e passa a expor as configurações de limites e taxas de forma dinâmica por meio da Query GraphQL `tierSettings`.

### Conteúdo da Branch
- **Configuração Única de Tiers**: Criação do objeto global `TIER_CONFIGS` no backend para ser a única fonte de verdade.
- **Novos Contratos de API**: Exposição da query GraphQL `tierSettings` para que o frontend carregue limites, taxas e recompensas diretamente da API em tempo real.
- **Interface Dinâmica**: O frontend foi atualizado para ler esses valores e renderizar uma seção chamada **"Dynamic Wallet Tier Settings"** que explica cada tier de forma automática.

### Erro Intencional Introduzido
No arquivo [`apps/api/src/resolvers/user.ts`](file:///Users/asael/Documents/IF1015/full-stack-consistency-pipeline/apps/api/src/resolvers/user.ts), no bloco de configurações do tier `GOLD`, a taxa percentual foi configurada como um número negativo:
```typescript
  {
    tier: UserTier.Gold,
    transactionLimit: 1500.0,
    feePercentage: -1.0, // BUG: Configuração de taxa negativa carregada do banco/resolver
    minSentVolume: 500.0,
    upgradeReward: 50.0,
  },
```

### Motivo e Mecanismo do Erro no Frontend
- **Motivo de passar na Build**: `-1.0` é um valor numérico perfeitamente compatível com os tipos GraphQL e TypeScript (`Float` e `number`).
- **Como acontece no Frontend (Runtime)**:
  - O frontend possui regras de consistência para garantir que configurações absurdas não causem falhas operacionais críticas (como loops de cashback malicioso ou limites inconsistentes).
  - Um invariante de runtime foi colocado no carregamento dos cartões de configurações:
    ```typescript
    if (setting.feePercentage < 0 || setting.transactionLimit < 0) {
      throw new Error(`Critical invariant violation: Negative config values loaded from API for tier ${setting.tier}!`);
    }
    ```
  - Quando a página é renderizada e os dados da API são recebidos, a validação interna detecta o valor `-1.0%` no tier `GOLD`.
  - A aplicação dispara a exceção e quebra a renderização da seção de configurações de tiers (exibindo a tela vermelha ou o erro capturado pelo React Error Boundary), quebrando a usabilidade do frontend diretamente na interface do usuário.
