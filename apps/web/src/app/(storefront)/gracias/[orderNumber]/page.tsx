import type { Metadata } from "next";
import { requireCustomerSession } from "@/lib/auth/session";
import { OrderConfirmationView } from "./OrderConfirmationView";

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
}

export const metadata: Metadata = { title: "Pedido confirmado", robots: { index: false } };

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  await requireCustomerSession(`/gracias/${orderNumber}`);
  return <OrderConfirmationView orderNumber={orderNumber} />;
}
