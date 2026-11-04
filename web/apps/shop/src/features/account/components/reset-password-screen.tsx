import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { ResetPasswordForm } from "./reset-password-form";

export function ResetPasswordScreen() {
  return (
    <AuthFrame title="Новий пароль" crumb="Новий пароль" perks={false}>
      <Suspense fallback={<AuthSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthFrame>
  );
}
