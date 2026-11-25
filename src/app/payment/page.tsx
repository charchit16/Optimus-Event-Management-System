"use client";

import React, { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";

const PaymentPage = () => {
  const Amount = 499; // Test amount in INR
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card">("upi");
  const [mockTxId, setMockTxId] = useState("");

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Amount * 100 }),
      });
      const data = await response.json();

      // Simulate network verification
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentSuccess(true);
        setMockTxId("mock_pay_" + Math.random().toString(36).substring(2, 10).toUpperCase());
      }, 1000);
    } catch (error) {
      console.error("Payment Simulation Error:", error);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setPaymentSuccess(false);
    setMockTxId("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md p-6 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700">
          <ShieldCheck className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold text-white">Optimus Mock Payment Gateway</h1>
        </div>

        {!paymentSuccess ? (
          <div>
            <div className="bg-gray-900/60 p-4 rounded-xl mb-4 border border-gray-700/60">
              <span className="text-xs uppercase tracking-wider text-gray-400">Total Due</span>
              <p className="text-3xl font-extrabold text-cyan-400 mt-1">₹{Amount}.00</p>
              <p className="text-xs text-gray-400 mt-1">Local Testing Environment (Zero Real Charges)</p>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                Select Simulation Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === "upi"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      : "border-gray-700 bg-gray-800/80 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-xs font-medium">UPI / QR Mock</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === "card"
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      : "border-gray-700 bg-gray-800/80 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs font-medium">Test Card Mock</span>
                </button>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Simulating Payment...</span>
                </>
              ) : (
                <span>Continue to Pay (Free Test)</span>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Payment Successful!</h2>
            <p className="text-sm text-gray-400 mb-4">Mock transaction approved instantly.</p>

            <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700 text-left mb-6 text-xs space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Transaction ID:</span>
                <span className="font-mono text-cyan-300">{mockTxId}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Amount Paid:</span>
                <span className="text-white font-semibold">₹{Amount}.00</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Status:</span>
                <span className="text-green-400 font-semibold">SUCCESS</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Simulate Another Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentPage;
