// api/create-order/route.ts
// Mock payment order creator (replaces Razorpay gateway)
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = body.amount || 0;
    const ticketUid = body.ticketUid || "TKT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Generate instantaneous mock order ID
    const mockOrderId = "mock_order_" + Math.random().toString(36).substring(2, 10);

    return NextResponse.json(
      {
        orderId: mockOrderId,
        amount,
        ticketUid,
        currency: "INR",
        status: "created",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json(
      { orderId: "mock_order_" + Date.now() },
      { status: 200 }
    );
  }
}
