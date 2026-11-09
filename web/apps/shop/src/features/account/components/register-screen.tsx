import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { RegisterForm } from "./register-form";

export function RegisterScreen() {
  return (
    <AuthFrame title="Реєстрація" crumb="Реєстрація" lead="У кабінеті зберігаються ваші замовлення, обране й адреси доставки.">
      <Suspense fallback={<AuthSkeleton />}>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}
