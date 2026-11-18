import { Suspense } from "react";
import { AuthFrame } from "./auth-frame";
import { AuthSkeleton } from "./auth-skeleton";
import { ForgotPasswordForm, NoPasswordMail } from "./forgot-password-form";

type MailProps = { mailDelivers: () => Promise<boolean> };

export function ForgotPasswordScreen({ mailDelivers }: MailProps) {
  return (
    <AuthFrame
      title="Відновлення пароля"
      crumb="Відновлення пароля"
      lead={
        <Suspense fallback={null}>
          <ForgotPasswordLead mailDelivers={mailDelivers} />
        </Suspense>
      }
      perks={false}
    >
      <Suspense fallback={<AuthSkeleton />}>
        <ForgotPasswordContent mailDelivers={mailDelivers} />
      </Suspense>
    </AuthFrame>
  );
}

async function ForgotPasswordLead({ mailDelivers }: MailProps) {
  if (!(await mailDelivers())) return null;
  return <p className="lead">Вкажіть email кабінету, і ми надішлемо посилання для нового пароля.</p>;
}

async function ForgotPasswordContent({ mailDelivers }: MailProps) {
  return (await mailDelivers()) ? <ForgotPasswordForm /> : <NoPasswordMail />;
}
