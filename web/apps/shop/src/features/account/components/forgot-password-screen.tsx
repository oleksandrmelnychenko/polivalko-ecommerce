import { AuthFrame } from "./auth-frame";
import { ForgotPasswordForm } from "./forgot-password-form";

export function ForgotPasswordScreen() {
  return (
    <AuthFrame title="Відновлення пароля" crumb="Відновлення пароля" lead="Вкажіть email кабінету, і ми надішлемо посилання для нового пароля." perks={false}>
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
