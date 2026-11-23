"use client";

import Link from "next/link";
import { UserIcon } from "@polivalko/shared/ui/icons";
import { useCustomer } from "../hooks/use-customer";
import { loginHref } from "../lib/login-href";

export function AccountButton() {
  const { status } = useCustomer();
  return (
    <Link href={status === "guest" ? loginHref("/account") : "/account"} className="icon-btn icon-btn--chrome account-button" aria-label="Особистий кабінет">
      <UserIcon />
      {status === "signedIn" && <span className="account-button__dot" aria-hidden="true" />}
    </Link>
  );
}
