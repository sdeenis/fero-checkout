<?php

namespace App\Http\Controllers;

use App\Http\Requests\CalculateCheckoutRequest;
use App\Http\Requests\CreateCheckoutOrderRequest;
use App\Services\CheckoutCalculator;
use App\Services\CheckoutOrderService;
use Illuminate\Support\Arr;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function calculate(CalculateCheckoutRequest $request, CheckoutCalculator $calculator): JsonResponse
    {
        return response()->json($calculator->calculate($request->validated()));
    }

    public function order(CreateCheckoutOrderRequest $request, CheckoutOrderService $orders): JsonResponse
    {
        $validated = $request->validated();
        [$status, $response] = $orders->place(
            Arr::except($validated, 'idempotency_key'),
            $validated['idempotency_key'],
        );

        return response()->json($response, $status);
    }
}
