import { Suspense } from "react";
import { pageMetadata } from "@/lib/metadata";
import { LoginView } from "@/views/login/login-view";

export function generateMetadata() {
  return pageMetadata("messageConnectWallet3", "/login");
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
