import type { OrderRequest, OrderResult, QuoteRequest, QuoteResponse } from './types'

export async function fetchQuote(request: QuoteRequest, signal: AbortSignal): Promise<QuoteResponse> {
  const response = await fetch('/api/checkout/quote', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) throw new Error(`Quote request failed: ${response.status}`)

  return response.json() as Promise<QuoteResponse>
}

export async function placeOrder(request: OrderRequest, key: string): Promise<OrderResult> {
  const response = await fetch('/api/checkout/order', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(request),
  })

  if (![201, 402, 409, 422].includes(response.status)) {
    throw new Error('Order outcome unknown')
  }

  return {
    status: response.status,
    data: await response.json(),
  } as OrderResult
}
