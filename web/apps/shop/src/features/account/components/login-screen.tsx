import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <AuthFrame title="Вхід до кабінету" crumb="Вхід">
      <Suspense fallback={<AuthSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
