<?php

namespace App\Http\Controllers;

use App\Http\Requests\CalculateCheckoutRequest;
use App\Services\CheckoutCalculator;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function calculate(CalculateCheckoutRequest $request, CheckoutCalculator $calculator): JsonResponse
    {
        return response()->json($calculator->calculate($request->validated()));
    }
}
