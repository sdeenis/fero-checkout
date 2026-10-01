export type Country = 'ES' | 'PT' | 'FR' | 'IT' | 'DE'
export type ShippingMethod = 'standard' | 'express'

export type QuoteRequest = {
  items: { sku: string; quantity: number }[]
  country: Country
  shipping_method: ShippingMethod
  promo_code?: string
}

export type QuoteResponse = {
  currency: 'EUR'
  subtotal_cents: number
  discount_cents: number
  shipping_cents: number
  vat_included_cents: number
  total_cents: number
  shipping_options: {
    method: ShippingMethod
    label: string
    price_cents: number
    eta_days: string
  }[]
  promo: {
    code: string | null
    applied: boolean
    rejection_reason: 'not_found' | 'already_redeemed' | 'min_spend_not_met' | null
  }
}
