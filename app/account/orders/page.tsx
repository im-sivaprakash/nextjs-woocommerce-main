import type { Metadata } from "next";
import { OrdersPageContent } from "@/components/account/orders-page-content";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View your past orders and tracking details.",
};

export default function OrdersPage() {
  return <OrdersPageContent />;
}
