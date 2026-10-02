import { AccountShell } from "@/components/account/account-shell";

export default function AccountLayout({ children }: LayoutProps<"/hesabim">) {
  return <AccountShell>{children}</AccountShell>;
}
