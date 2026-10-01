<?php

namespace Tests\Feature;

use Illuminate\Support\Str;
use Tests\TestCase;

class CheckoutOrderTest extends TestCase
{
    private string $storePath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->storePath = storage_path(
            'app/private/checkout-orders.json'
        );

        @unlink($this->storePath);
    }

    protected function tearDown(): void
    {
        @unlink($this->storePath);

        parent::tearDown();
    }

    public function test_it_creates_an_order_for_an_approved_payment(): void
    {
        $key = (string) Str::uuid();

        $response = $this->postJson(
            '/api/checkout/order',
            $this->payload(),
            ['Idempotency-Key' => $key],
        );

        $response
            ->assertCreated()
            ->assertJsonPath('status', 'confirmed')
            ->assertJsonPath('total_cents', 2798)
            ->assertJsonStructure([
                'order_id',
                'status',
                'total_cents',
            ])
            ->assertJsonMissingPath('card_number');

        $contents = file_get_contents($this->storePath);
        $store = json_decode($contents, true);

        $this->assertCount(1, $store['orders']);
        $this->assertSame(
            'buyer@example.com',
            $store['orders'][0]['email']
        );

        $this->assertStringNotContainsString(
            '4111111111111111',
            $contents
        );
    }

    public function test_it_does_not_create_an_order_for_a_declined_payment(): void
    {
        $key = (string) Str::uuid();

        $response = $this->postJson(
            '/api/checkout/order',
            $this->payload('4000000000000002'),
            ['Idempotency-Key' => $key],
        );

        $response
            ->assertStatus(402)
            ->assertExactJson([
                'error' => 'card_declined',
            ]);

        $contents = file_get_contents($this->storePath);
        $store = json_decode($contents, true);

        $this->assertSame([], $store['orders']);
        $this->assertSame(
            402,
            $store['idempotency'][$key]['status']
        );

        $this->assertStringNotContainsString(
            '4000000000000002',
            $contents
        );
    }

    public function test_it_rejects_an_expired_card(): void
    {
        $key = (string) Str::uuid();

        $response = $this->postJson(
            '/api/checkout/order',
            $this->payload('4000000000000069'),
            ['Idempotency-Key' => $key],
        );

        $response
            ->assertStatus(402)
            ->assertExactJson([
                'error' => 'expired_card',
            ]);

        $store = json_decode(
            file_get_contents($this->storePath),
            true
        );

        $this->assertSame([], $store['orders']);
        $this->assertSame(
            402,
            $store['idempotency'][$key]['status']
        );
    }

    public function test_it_returns_the_original_response_for_a_repeated_request(): void
    {
        $key = (string) Str::uuid();
        $headers = ['Idempotency-Key' => $key];

        $first = $this->postJson(
            '/api/checkout/order',
            $this->payload(),
            $headers,
        );

        $second = $this->postJson(
            '/api/checkout/order',
            $this->payload(),
            $headers,
        );

        $first->assertCreated();

        $second
            ->assertCreated()
            ->assertExactJson($first->json());

        $store = json_decode(
            file_get_contents($this->storePath),
            true
        );

        $this->assertCount(1, $store['orders']);
    }

    public function test_it_rejects_a_reused_key_with_different_data(): void
    {
        $key = (string) Str::uuid();
        $headers = ['Idempotency-Key' => $key];

        $this->postJson(
            '/api/checkout/order',
            $this->payload(),
            $headers,
        )->assertCreated();

        $this->postJson(
            '/api/checkout/order',
            $this->payload('4000000000000002'),
            $headers,
        )
            ->assertConflict()
            ->assertExactJson([
                'error' => 'idempotency_key_reused',
            ]);

        $store = json_decode(
            file_get_contents($this->storePath),
            true
        );

        $this->assertCount(1, $store['orders']);
    }

    public function test_it_requires_an_idempotency_key(): void
    {
        $this->postJson(
            '/api/checkout/order',
            $this->payload(),
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');
    }

    private function payload(
        string $cardNumber = '4111111111111111'
    ): array {
        return [
            'items' => [
                [
                    'sku' => 'TSHIRT-001',
                    'quantity' => 1,
                ],
            ],
            'country' => 'PT',
            'shipping_method' => 'standard',
            'email' => 'buyer@example.com',
            'card_number' => $cardNumber,
        ];
    }
}