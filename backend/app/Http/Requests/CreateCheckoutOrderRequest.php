<?php

namespace App\Http\Requests;

class CreateCheckoutOrderRequest extends CalculateCheckoutRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'idempotency_key' => $this->header('Idempotency-Key'),
        ]);
    }

    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'email' => ['required', 'email'],
            'card_number' => ['required', 'string', 'digits:16'],
            'idempotency_key' => ['required', 'uuid'],
        ]);
    }
}
