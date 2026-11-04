import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { ConfirmEmail } from "./confirm-email";

export function ConfirmEmailScreen() {
  return (
    <AuthFrame title="Підтвердження email" crumb="Підтвердження email" perks={false}>
      <Suspense fallback={<AuthSkeleton />}>
        <ConfirmEmail />
      </Suspense>
    </AuthFrame>
  );
}
