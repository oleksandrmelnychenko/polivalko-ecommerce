import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { RegisterForm } from "./register-form";

export function RegisterScreen() {
  return (
    <AuthFrame title="Реєстрація" crumb="Реєстрація" lead="Кілька полів, і замовлення, обране та адреси будуть під рукою.">
      <Suspense fallback={<AuthSkeleton />}>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}
