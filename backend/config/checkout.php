<?php

return [
    'currency' => 'EUR',

    'products' => [
        'TSHIRT-001' => [
            'name' => 'Classic Tee',
            'unit_price_cents' => 1999,
        ],
        'MUG-042' => [
            'name' => 'Enamel Mug',
            'unit_price_cents' => 1250,
        ],
        'SOCK-007' => [
            'name' => 'Wool Socks',
            'unit_price_cents' => 890,
        ],
    ],

    'countries' => [
        'ES' => [
            'vat_rate' => 21,
            'free_standard_from_cents' => 5000,
            'shipping' => [
                'standard' => [
                    'price_cents' => 499,
                    'eta_days' => '3-5',
                ],
                'express' => [
                    'price_cents' => 999,
                    'eta_days' => '1-2',
                ],
            ],
        ],
        'PT' => [
            'vat_rate' => 23,
            'shipping' => [
                'standard' => ['price_cents' => 799, 'eta_days' => '4-7'],
                'express' => ['price_cents' => 1499, 'eta_days' => '2-3'],
            ],
        ],
        'FR' => [
            'vat_rate' => 20,
            'shipping' => [
                'standard' => ['price_cents' => 799, 'eta_days' => '4-7'],
                'express' => ['price_cents' => 1499, 'eta_days' => '2-3'],
            ],
        ],
        'IT' => [
            'vat_rate' => 22,
            'shipping' => [
                'standard' => ['price_cents' => 799, 'eta_days' => '4-7'],
                'express' => ['price_cents' => 1499, 'eta_days' => '2-3'],
            ],
        ],
        'DE' => [
            'vat_rate' => 19,
            'shipping' => [
                'standard' => ['price_cents' => 799, 'eta_days' => '4-7'],
                'express' => ['price_cents' => 1499, 'eta_days' => '2-3'],
            ],
        ],
    ],

    'promos' => [
        'WELCOME10' => [
            'type' => 'percentage',
            'value' => 10,
            'min_spend_cents' => 3000,
            'already_redeemed' => false,
        ],
        'FREESHIP' => [
            'type' => 'free_shipping',
            'value' => null,
            'min_spend_cents' => 2500,
            'already_redeemed' => false,
        ],
        'VIP50' => [
            'type' => 'percentage',
            'value' => 50,
            'min_spend_cents' => 0,
            'already_redeemed' => true,
        ],
    ],
];
