<?php

namespace App\Services;

class CheckoutCalculator
{
    public function calculate(array $checkout): array
    {
        $configuration = config('checkout');
        $country = $configuration['countries'][$checkout['country']];
        $subtotalCents = 0;

        foreach ($checkout['items'] as $item) {
            $subtotalCents += $configuration['products'][$item['sku']]['unit_price_cents'] * $item['quantity'];
        }

        $promoCode = trim($checkout['promo_code'] ?? '');
        $promoCode = $promoCode === '' ? null : strtoupper($promoCode);
        $promo = $promoCode === null ? null : ($configuration['promos'][$promoCode] ?? null);
        $promoRejectionReason = null;
        $discountCents = 0;
        $freeShippingPromo = false;

        if ($promoCode !== null) {
            if ($promo === null) {
                $promoRejectionReason = 'not_found';
            } elseif ($promo['already_redeemed']) {
                $promoRejectionReason = 'already_redeemed';
            } elseif ($subtotalCents < $promo['min_spend_cents']) {
                $promoRejectionReason = 'min_spend_not_met';
            } elseif ($promo['type'] === 'percentage') {
                $discountCents = intdiv(($subtotalCents * $promo['value']) + 50, 100);
            } elseif ($promo['type'] === 'free_shipping') {
                $freeShippingPromo = true;
            }
        }

        $discountedSubtotalCents = $subtotalCents - $discountCents;
        $shippingOptions = [];
        $shippingCents = 0;

        foreach ($country['shipping'] as $method => $shipping) {
            $effectivePriceCents = $shipping['price_cents'];

            if (
                $method === 'standard'
                && isset($country['free_standard_from_cents'])
                && $discountedSubtotalCents >= $country['free_standard_from_cents']
            ) {
                $effectivePriceCents = 0;
            }

            if (
                $freeShippingPromo
                && $method === $checkout['shipping_method']
            ) {
                $effectivePriceCents = 0;
            }

            $shippingOptions[] = [
                'method' => $method,
                'label' => ucfirst($method),
                'price_cents' => $effectivePriceCents,
                'eta_days' => $shipping['eta_days'],
            ];

            if ($method === $checkout['shipping_method']) {
                $shippingCents = $effectivePriceCents;
            }
        }

        $totalCents = $discountedSubtotalCents + $shippingCents;
        $vatExclusiveCents = intdiv(($totalCents * 100) + intdiv(100 + $country['vat_rate'], 2), 100 + $country['vat_rate']);
        $vatIncludedCents = $totalCents - $vatExclusiveCents;

        return [
            'currency' => $configuration['currency'],
            'subtotal_cents' => $subtotalCents,
            'discount_cents' => $discountCents,
            'shipping_cents' => $shippingCents,
            'vat_included_cents' => $vatIncludedCents,
            'total_cents' => $totalCents,
            'shipping_options' => $shippingOptions,
            'promo' => [
                'code' => $promoCode,
                'applied' => $promoCode !== null && $promoRejectionReason === null,
                'rejection_reason' => $promoRejectionReason,
            ],
        ];
    }
}
