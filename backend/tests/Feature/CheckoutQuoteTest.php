<?php

namespace Tests\Feature;

use Tests\TestCase;

class CheckoutQuoteTest extends TestCase
{
    public function test_it_calculates_subtotal_shipping_vat_and_total(): void
    {
        $response = $this->postJson('/api/checkout/quote', [
            'items' => [
                ['sku' => 'TSHIRT-001', 'quantity' => 1],
                ['sku' => 'MUG-042', 'quantity' => 1],
            ],
            'country' => 'PT',
            'shipping_method' => 'standard',
        ]);

        $response->assertOk()->assertJsonPath('subtotal_cents', 3249)
            ->assertJsonPath('discount_cents', 0)
            ->assertJsonPath('shipping_cents', 799)
            ->assertJsonPath('vat_included_cents', 757)
            ->assertJsonPath('total_cents', 4048)
            ->assertJsonPath('shipping_options.0', [
                'method' => 'standard',
                'label' => 'Standard',
                'price_cents' => 799,
                'eta_days' => '4-7',
            ]);
    }

    public function test_it_applies_welcome10_to_an_eligible_subtotal(): void
    {
        $response = $this->postJson('/api/checkout/quote', [
            'items' => [['sku' => 'TSHIRT-001', 'quantity' => 2]],
            'country' => 'PT',
            'shipping_method' => 'standard',
            'promo_code' => 'WELCOME10',
        ]);

        $response->assertOk()->assertJsonPath('subtotal_cents', 3998)
            ->assertJsonPath('discount_cents', 400)
            ->assertJsonPath('shipping_cents', 799)
            ->assertJsonPath('vat_included_cents', 822)
            ->assertJsonPath('total_cents', 4397)
            ->assertJsonPath('promo.applied', true)
            ->assertJsonPath('promo.rejection_reason', null);
    }

    public function test_es_free_standard_shipping_uses_the_subtotal_after_discount(): void
    {
        $response = $this->postJson('/api/checkout/quote', [
            'items' => [['sku' => 'MUG-042', 'quantity' => 4]],
            'country' => 'ES',
            'shipping_method' => 'standard',
            'promo_code' => 'WELCOME10',
        ]);

        $response->assertOk()->assertJsonPath('subtotal_cents', 5000)
            ->assertJsonPath('discount_cents', 500)
            ->assertJsonPath('shipping_cents', 499)
            ->assertJsonPath('vat_included_cents', 868)
            ->assertJsonPath('total_cents', 4999);
    }

    public function test_an_invalid_promo_returns_undiscounted_totals_and_a_rejection_reason(): void
    {
        $response = $this->postJson('/api/checkout/quote', [
            'items' => [['sku' => 'TSHIRT-001', 'quantity' => 1]],
            'country' => 'PT',
            'shipping_method' => 'standard',
            'promo_code' => 'NOT-A-PROMO',
        ]);

        $response->assertOk()->assertJsonPath('discount_cents', 0)
            ->assertJsonPath('promo.applied', false)
            ->assertJsonPath('promo.rejection_reason', 'not_found');
    }

    public function test_an_unsupported_country_is_rejected(): void
    {
        $response = $this->postJson('/api/checkout/quote', [
            'items' => [['sku' => 'TSHIRT-001', 'quantity' => 1]],
            'country' => 'GB',
            'shipping_method' => 'standard',
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('country')
            ->assertJsonPath('reason', 'country_not_supported');
    }
}
