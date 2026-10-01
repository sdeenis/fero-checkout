import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fetchQuote } from './api'
import type { Country, QuoteResponse, ShippingMethod } from './types'

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

function App() {
  const activeRequest = useRef<AbortController | null>(null)
  const [country, setCountry] = useState<Country>('ES')
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard')
  const [promotionText, setPromotionText] = useState('')
  const [appliedPromotion, setAppliedPromotion] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSpinner, setShowSpinner] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

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

  function applyPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = promotionText.trim()

    if (code) {
      startRefresh()
      setAppliedPromotion(code)
      if (code === appliedPromotion) setRetryCount((count) => count + 1)
    }
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
                  onChange={(event) => { startRefresh(); setCountry(event.target.value as Country) }}
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
                        onChange={() => { startRefresh(); setShippingMethod(option.method) }}
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
                    aria-invalid={promotionError && promotionText.trim() === appliedPromotion ? true : undefined}
                    aria-describedby={promotionError && promotionText.trim() === appliedPromotion ? 'promotion-feedback' : undefined}
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  />
                  <button
                    type="submit"
                    disabled={!promotionText.trim()}
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
                    onClick={() => { startRefresh(); setAppliedPromotion(null); setPromotionText('') }}
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

              {quote ? (
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Subtotal</dt><dd>{formatEuro(quote.subtotal_cents)}</dd></div>
                  {quote.discount_cents > 0 && <div className="flex justify-between gap-4"><dt className="text-slate-600">Discount</dt><dd className="text-indigo-700">−{formatEuro(quote.discount_cents)}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Shipping</dt><dd>{quote.shipping_cents === 0 ? 'Free' : formatEuro(quote.shipping_cents)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">VAT included</dt><dd>{formatEuro(quote.vat_included_cents)}</dd></div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-base font-semibold"><dt>Total</dt><dd>{formatEuro(quote.total_cents)}</dd></div>
                </dl>
              ) : <p className="mt-5 text-sm text-slate-500">Your total will appear here when the quote loads.</p>}
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
