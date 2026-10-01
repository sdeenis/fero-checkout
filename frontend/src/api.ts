import type { QuoteRequest, QuoteResponse } from './types'

export async function fetchQuote(request: QuoteRequest, signal: AbortSignal): Promise<QuoteResponse> {
  const response = await fetch('/api/checkout/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) throw new Error(`Quote request failed: ${response.status}`)

  return response.json() as Promise<QuoteResponse>
}
