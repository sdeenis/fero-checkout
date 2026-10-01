<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CalculateCheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],

            'items.*.sku' => [
                'required',
                'string',
                Rule::in(array_keys(config('checkout.products'))),
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
            ],

            'country' => [
                'required',
                'string',
                Rule::in(array_keys(config('checkout.countries'))),
            ],

            'shipping_method' => [
                'required',
                'string',
                Rule::in(['standard', 'express']),
            ],

            'promo_code' => [
                'nullable',
                'string',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'country.in' => 'country_not_supported'
            ];
    }
}