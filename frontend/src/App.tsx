import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fetchQuote, placeOrder } from './api'
import type { Country, OrderConfirmation, OrderRequest, QuoteResponse, ShippingMethod } from './types'

const cart = [
  { sku: 'TSHIRT-001', name: 'Classic Tee', quantity: 2, unitPriceCents: 1999 },
  { sku: 'MUG-042', name: 'Enamel Mug', quantity: 1, unitPriceCents: 1250 },
] as const

const countries: { code: Country; name: string }[] = [
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'DE', name: 'Germany' },
]

const promotionMessages: Record<string, string> = {
  not_found: 'We couldn’t find that promotion code.',
  already_redeemed: 'This promotion code has already been used.',
  min_spend_not_met: 'Your cart does not meet the minimum spend for this promotion.',
}

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
const formatEuro = (cents: number) => euro.format(cents / 100)
type PendingOrder = { key: string; body: OrderRequest }

function App() {
  const activeRequest = useRef<AbortController | null>(null)
  const orderInFlight = useRef(false)
  const [country, setCountry] = useState<Country>('ES')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard')
  const [promotionText, setPromotionText] = useState('')
  const [appliedPromotion, setAppliedPromotion] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [email, setEmail] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingRetry, setPendingRetry] = useState<PendingOrder | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    activeRequest.current = controller
    const spinnerTimer = window.setTimeout(() => {
      if (!controller.signal.aborted) setShowSpinner(true)
    }, 200)

    fetchQuote(
      {
        items: cart.map(({ sku, quantity }) => ({ sku, quantity })),
        country,
        shipping_method: shippingMethod,
        ...(appliedPromotion ? { promo_code: appliedPromotion } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        window.clearTimeout(spinnerTimer)
        if (!controller.signal.aborted) {
          setQuote(response)
          setIsLoading(false)
        }
      })
      .catch(() => {
        window.clearTimeout(spinnerTimer)
        if (!controller.signal.aborted) {
          setQuoteError('We couldn’t update your quote. Please try again.')
          setIsLoading(false)
        }
      })

    return () => {
      controller.abort()
      window.clearTimeout(spinnerTimer)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [country, shippingMethod, appliedPromotion, retryCount])

  const promotionResult = quote?.promo.code === appliedPromotion ? quote.promo : null
  const promotionError = promotionResult?.rejection_reason
    ? promotionMessages[promotionResult.rejection_reason] ?? 'This promotion code could not be applied.'
    : null
  const promotionFeedback = promotionResult?.applied
    ? `${appliedPromotion} applied`
    : promotionError ?? (quoteError || promotionResult
      ? 'Could not verify this code.'
      : `Checking ${appliedPromotion}…`)

  function startRefresh() {
    activeRequest.current?.abort()
    setIsLoading(true)
    setShowSpinner(false)
    setQuoteError(null)
  }

  function clearOrderFeedback() {
    setPendingRetry(null)
    setPaymentError(null)
    setOrderError(null)
  }

  function applyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = promotionText.trim().toUpperCase()

    if (code) {
      setPromotionText(code)

      if (code !== appliedPromotion) clearOrderFeedback()
      startRefresh()
      setAppliedPromotion(code)
      if (code === appliedPromotion) setRetryCount((count) => count + 1)
    }
  }

  async function submitAttempt(attempt: PendingOrder) {
    if (orderInFlight.current) return
    orderInFlight.current = true
    setIsSubmitting(true)
    setPaymentError(null)
    setOrderError(null)

    try {
      const result = await placeOrder(attempt.body, attempt.key)
      setPendingRetry(null)

      if (result.status === 201) {
        setConfirmation(result.data)
        setCardNumber('')
      } else if (result.status === 402) {
        setPaymentError(result.data.error === 'expired_card'
          ? 'This card has expired. Try another card.'
          : 'This card was declined. Try another card.')
      } else if (result.status === 422) {
        setPaymentError(result.data.errors?.email
          ? 'Enter a valid email address.'
          : result.data.errors?.card_number
            ? 'Enter a 16-digit card number.'
            : 'Please check your checkout details and try again.')
      } else if (result.status === 409) {
        setOrderError('Your order details changed. Please review them and try again.')
      }
    } catch {
      setPendingRetry(attempt)
      setOrderError('We couldn’t confirm your order. Retry with the same details.')
    } finally {
      orderInFlight.current = false
      setIsSubmitting(false)
    }
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quote || isLoading || quoteError || isSubmitting || orderInFlight.current || pendingRetry) return

    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length !== 16) {
      setPaymentError('Enter a 16-digit card number.')
      return
    }

    const body: OrderRequest = {
      items: cart.map(({ sku, quantity }) => ({ sku, quantity })),
      country,
      shipping_method: shippingMethod,
      ...(appliedPromotion ? { promo_code: appliedPromotion } : {}),
      email: email.trim(),
      card_number: digits,
    }

    void submitAttempt({ key: crypto.randomUUID(), body })
  }

  if (confirmation) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:py-20">
        <main className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <span className="text-xl font-bold tracking-tight text-indigo-700">FERO</span>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Order confirmed</h1>
          <p className="mt-2 text-sm text-slate-600">Thank you. Your order has been placed.</p>
          <dl className="mt-8 space-y-4 border-t border-slate-200 pt-6 text-sm">
            <div><dt className="text-slate-600">Order ID</dt><dd className="mt-1 break-all font-medium">{confirmation.order_id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-600">Confirmed total</dt><dd className="font-semibold">{formatEuro(confirmation.total_cents)}</dd></div>
          </dl>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <span className="text-xl font-bold tracking-tight text-indigo-700">FERO</span>
          <span className="text-sm text-slate-500">Checkout</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Review your order</h1>
          <p className="mt-2 text-sm text-slate-600">Check your items and delivery options.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
          <div className="space-y-6">
            <section aria-labelledby="cart-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 id="cart-heading" className="text-lg font-semibold">Your cart</h2>
              <ul className="mt-5 divide-y divide-slate-100">
                {cart.map((item) => (
                  <li key={item.sku} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Qty {item.quantity} · {formatEuro(item.unitPriceCents)} each
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="delivery-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 id="delivery-heading" className="text-lg font-semibold">Delivery</h2>
              <div className="mt-5">
                <label htmlFor="country" className="block text-sm font-medium">Country</label>
                <select
                  id="country"
                  value={country}
                  onChange={(event) => { clearOrderFeedback(); startRefresh(); setCountry(event.target.value as Country) }}
                  disabled={isSubmitting}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>

              <fieldset className="mt-6">
                <legend className="text-sm font-medium">Shipping method</legend>
                <div className="mt-3 space-y-3">
                  {quote ? quote.shipping_options.map((option) => (
                    <label
                      key={option.method}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 ${shippingMethod === option.method ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                    >
                      <input
                        type="radio"
                        name="shipping-method"
                        value={option.method}
                        checked={shippingMethod === option.method}
                        onChange={() => { clearOrderFeedback(); startRefresh(); setShippingMethod(option.method) }}
                        disabled={isSubmitting}
                        className="size-4 shrink-0 accent-indigo-600"
                      />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="mt-1 block text-slate-600">{option.eta_days} business days</span>
                        </span>
                        <span className="shrink-0 font-medium">{option.price_cents === 0 ? 'Free' : formatEuro(option.price_cents)}</span>
                      </span>
                    </label>
                  )) : <p className="text-sm text-slate-500">{quoteError ? 'Delivery options unavailable.' : 'Loading delivery options…'}</p>}
                </div>
              </fieldset>
            </section>

            <section aria-labelledby="payment-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 id="payment-heading" className="text-lg font-semibold">Payment</h2>
              <form id="payment-form" onSubmit={submitOrder} className="mt-5 space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => { clearOrderFeedback(); setEmail(event.target.value) }}
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  />
                </div>
                <div>
                  <label htmlFor="card-number" className="block text-sm font-medium">Card number</label>
                  <input
                    id="card-number"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    pattern="[0-9]{16}"
                    maxLength={16}
                    required
                    value={cardNumber}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 16)
                      if (digits !== cardNumber) { clearOrderFeedback(); setCardNumber(digits) }
                    }}
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  />
                  <p className="mt-2 text-xs text-slate-500">Enter 16 digits without spaces.</p>
                </div>
                {paymentError && <p role="alert" className="text-sm text-red-700">{paymentError}</p>}
              </form>
              <details className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Test cards</summary>
                <ul className="mt-3 space-y-1 text-xs">
                  <li>4111111111111111 — approved</li>
                  <li>4000000000000002 — declined</li>
                  <li>4000000000000069 — expired</li>
                </ul>
              </details>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6">
            <section aria-labelledby="promotion-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 id="promotion-heading" className="text-lg font-semibold">Promotion code</h2>
              <form onSubmit={applyPromotion} className="mt-4">
                <label htmlFor="promotion-code" className="block text-sm font-medium">Code</label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="promotion-code"
                    type="text"
                    value={promotionText}
                    onChange={(event) => setPromotionText(event.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={promotionError && promotionText.trim().toUpperCase() === appliedPromotion ? true : undefined}
                    aria-describedby={promotionError && promotionText.trim().toUpperCase() === appliedPromotion ? 'promotion-feedback' : undefined}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={!promotionText.trim() || isSubmitting}
                    className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </form>
              {appliedPromotion && (
                <div className="mt-3 flex items-start justify-between gap-3 text-sm">
                  <p id="promotion-feedback" role={promotionError ? 'alert' : 'status'} className={promotionError ? 'text-red-700' : 'text-slate-600'}>
                    {promotionFeedback}
                  </p>
                  <button
                    type="button"
                    onClick={() => { clearOrderFeedback(); startRefresh(); setAppliedPromotion(null); setPromotionText('') }}
                    disabled={isSubmitting}
                    className="shrink-0 font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </section>

            <section aria-labelledby="summary-heading" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 id="summary-heading" className="text-lg font-semibold">Order summary</h2>
                {isLoading && showSpinner && (
                  <span role="status">
                    <span aria-hidden="true" className="block size-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 motion-reduce:animate-none" />
                    <span className="sr-only">Updating totals</span>
                  </span>
                )}
              </div>

              {quoteError && (
                <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p>{quoteError}</p>
                  <button
                    type="button"
                    onClick={() => { startRefresh(); setRetryCount((count) => count + 1) }}
                    className="mt-2 font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Retry
                  </button>
                </div>
              )}

              {orderError && (
                <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p>{orderError}</p>
                  {pendingRetry && (
                    <button
                      type="button"
                      onClick={() => { void submitAttempt(pendingRetry) }}
                      disabled={isSubmitting}
                      className="mt-2 font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      Retry order
                    </button>
                  )}
                </div>
              )}

              {quote ? (
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Subtotal</dt><dd>{formatEuro(quote.subtotal_cents)}</dd></div>
                  {quote.discount_cents > 0 && <div className="flex justify-between gap-4"><dt className="text-slate-600">Discount</dt><dd className="text-indigo-700">−{formatEuro(quote.discount_cents)}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Shipping</dt><dd>{quote.shipping_cents === 0 ? 'Free' : formatEuro(quote.shipping_cents)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">VAT included</dt><dd>{formatEuro(quote.vat_included_cents)}</dd></div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-base font-semibold"><dt>Total</dt><dd>{formatEuro(quote.total_cents)}</dd></div>
                </dl>
              ) : <p className="mt-5 text-sm text-slate-500">Your total will appear here when the quote loads.</p>}
              <button
                type="submit"
                form="payment-form"
                disabled={!quote || isLoading || !!quoteError || isSubmitting || !!pendingRetry}
                className="mt-6 w-full rounded-lg bg-indigo-700 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Placing order…' : 'Place order'}
              </button>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
