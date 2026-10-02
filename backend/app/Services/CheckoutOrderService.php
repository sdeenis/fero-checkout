<?php

namespace App\Services;

use Illuminate\Support\Str;
use RuntimeException;

class CheckoutOrderService
{
    public function __construct(private CheckoutCalculator $calculator)
    {
    }

    public function place(array $checkout, string $idempotencyKey): array
    {
        $path = config('checkout.order_store_path');
        $directory = dirname($path);

        if (! is_dir($directory) && ! mkdir($directory, 0775, true) && ! is_dir($directory)) {
            throw new RuntimeException('Unable to create checkout order storage directory.');
        }

        $handle = fopen($path, 'c+');

        if ($handle === false) {
            throw new RuntimeException('Unable to open checkout order storage.');
        }

        try {
            if (! flock($handle, LOCK_EX)) {
                throw new RuntimeException('Unable to lock checkout order storage.');
            }

            rewind($handle);
            $contents = stream_get_contents($handle);
            $store = $contents === '' ? $this->emptyStore() : json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            $fingerprint = $this->fingerprint($checkout);
            $existing = $store['idempotency'][$idempotencyKey] ?? null;

            if ($existing !== null) {
                if (! hash_equals($existing['fingerprint'], $fingerprint)) {
                    return [409, ['error' => 'idempotency_key_reused']];
                }

                return [$existing['status'], $existing['response']];
            }

            $pricing = $this->calculator->calculate($checkout);

            $paymentError = $this->paymentError($checkout['card_number']);

            if ($paymentError !== null) {
                $status = 402;
                $response = [
                    'error' => $paymentError,
                ];
            } else {
                $orderId = (string) Str::uuid();

                $order = [
                    'id' => $orderId,
                    'email' => $checkout['email'],
                    'pricing' => $pricing,
                    'status' => 'confirmed',
                ];

                $store['orders'][] = $order;

                $status = 201;
                $response = [
                    'order_id' => $orderId,
                    'status' => 'confirmed',
                    'total_cents' => $pricing['total_cents'],
                ];
            }

            $store['idempotency'][$idempotencyKey] = [
                'fingerprint' => $fingerprint,
                'status' => $status,
                'response' => $response,
            ];

            $this->rewrite($handle, $store);

            return [$status, $response];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function emptyStore(): array
    {
        return ['orders' => [], 'idempotency' => []];
    }

    private function fingerprint(array $checkout): string
    {
        return hash_hmac(
            'sha256',
            json_encode($this->canonicalize($checkout), JSON_THROW_ON_ERROR),
            (string) config('app.key'),
        );
    }

    private function canonicalize(array $value): array
    {
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = $this->canonicalize($item);
            }
        }

        if (! array_is_list($value)) {
            ksort($value);
        }

        return $value;
    }

    private function paymentError(string $cardNumber): ?string
    {
        return match ($cardNumber) {
            '4111111111111111' => null,
            '4000000000000002' => 'card_declined',
            '4000000000000069' => 'expired_card',
            default => 'card_declined',
        };
    }

    private function rewrite($handle, array $store): void
    {
        $json = json_encode($store, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);

        if (! ftruncate($handle, 0)) {
            throw new RuntimeException('Unable to truncate checkout order storage.');
        }

        rewind($handle);
        $written = fwrite($handle, $json);

        if ($written !== strlen($json) || ! fflush($handle)) {
            throw new RuntimeException('Unable to write checkout order storage.');
        }
    }
}
