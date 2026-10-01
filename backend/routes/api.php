<?php

use App\Http\Controllers\CheckoutController;
use Illuminate\Support\Facades\Route;

Route::post('/checkout/quote', [CheckoutController::class, 'calculate']);
Route::post('/checkout/order', [CheckoutController::class, 'order']);
