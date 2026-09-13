import type { Metadata } from "next";
import { AccountPageContent } from "@/components/account/account-page-content";

export const metadata: Metadata = {
  title: "My Account",
  description: "View and manage your account details and orders.",
};

export default function AccountPage() {
  return <AccountPageContent />;
}
