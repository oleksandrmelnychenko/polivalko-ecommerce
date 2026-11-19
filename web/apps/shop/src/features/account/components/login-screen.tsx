import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <AuthFrame title="Вхід до акаунта" crumb="Вхід" lead="Увійдіть, щоб бачити свої замовлення та швидше оформлювати наступні покупки.">
      <Suspense fallback={<AuthSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
