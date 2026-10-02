import type { Metadata } from "next";
import { AddressList } from "@/components/account/address-list";

export const metadata: Metadata = { title: "Adreslerim" };

export default function AddressesPage() {
  return <AddressList />;
}
