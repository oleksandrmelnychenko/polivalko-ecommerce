import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { RegisterForm } from "./register-form";

export function RegisterScreen({ mailDelivers }: { mailDelivers: () => Promise<boolean> }) {
  return (
    <AuthFrame title="Реєстрація" crumb="Реєстрація" lead="У кабінеті зберігаються ваші замовлення, обране й адреси доставки.">
      <Suspense fallback={<AuthSkeleton />}>
        <RegisterContent mailDelivers={mailDelivers} />
      </Suspense>
    </AuthFrame>
  );
}

async function RegisterContent({ mailDelivers }: { mailDelivers: () => Promise<boolean> }) {
  return <RegisterForm mailDelivers={await mailDelivers()} />;
}
