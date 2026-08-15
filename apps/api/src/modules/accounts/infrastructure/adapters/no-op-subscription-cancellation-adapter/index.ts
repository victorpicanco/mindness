import type { SubscriptionCancellation } from '@/modules/accounts/domain/ports/subscription-cancellation/index.js'

// Bloco 1, decisão assumida A-03: cobrança pertence ao bloco de assinatura. Até lá a exclusão
// só precisa do contrato, e cancelar nada é o comportamento correto de uma conta sem plano pago.
export class NoOpSubscriptionCancellationAdapter implements SubscriptionCancellation {
  cancelActiveSubscription(): Promise<void> {
    return Promise.resolve()
  }
}
