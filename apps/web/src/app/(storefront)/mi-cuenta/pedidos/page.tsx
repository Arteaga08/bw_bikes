import type { PublicOrder } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { serverApiFetch } from "@/lib/api/server";
import { OrdersHistoryView } from "./OrdersHistoryView";

export const metadata: Metadata = { title: "Historial de pedidos" };

interface PedidosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const rawSearchParams = await searchParams;
  const pageParam = rawSearchParams["page"];
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;

  const { data, meta } = await serverApiFetch<{ orders: PublicOrder[] }>(`/orders?page=${page}`);

  return <OrdersHistoryView orders={data.orders} meta={meta} />;
}
