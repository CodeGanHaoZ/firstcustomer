export type PaymentRequest = { paymentId: string; orderId: string; amountFen: number; currency: "CNY" };
export type PaymentResult = PaymentRequest & { provider: "simulated"; status: "succeeded" | "failed"; reference: string };
export type PaymentProvider = { name: "simulated"; verify: (request: PaymentRequest) => Promise<PaymentResult> };

// This flag is server-only. Production must explicitly opt in; a missing real
// provider must never silently fall back to accepting payments.
export function paymentsEnabled() {
  const mode = process.env.PAYMENT_MODE ?? (process.env.NODE_ENV === "production" ? "disabled" : "simulated");
  return mode === "simulated";
}

export function paymentProvider(): PaymentProvider {
  if (!paymentsEnabled()) throw new Error("支付暂不可用，请稍后重试");
  return {
    name: "simulated",
    verify: async (request) => ({ ...request, provider: "simulated", status: "succeeded", reference: `sim_${request.paymentId}` }),
  };
}
