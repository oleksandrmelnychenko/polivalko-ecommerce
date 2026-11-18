import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { ConfirmEmail } from "./confirm-email";

export function ConfirmEmailScreen({ mailDelivers }: { mailDelivers: () => Promise<boolean> }) {
  return (
    <AuthFrame title="Підтвердження email" crumb="Підтвердження email" perks={false}>
      <Suspense fallback={<AuthSkeleton />}>
        <ConfirmEmailContent mailDelivers={mailDelivers} />
      </Suspense>
    </AuthFrame>
  );
}

async function ConfirmEmailContent({ mailDelivers }: { mailDelivers: () => Promise<boolean> }) {
  return <ConfirmEmail mailDelivers={await mailDelivers()} />;
}
