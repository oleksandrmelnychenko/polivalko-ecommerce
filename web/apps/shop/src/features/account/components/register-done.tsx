import Link from "next/link";

export function RegisterDone({ email, next }: { email: string; next: string }) {
  return (
    <div className="auth__done">
      <p className="notice notice--ok">
        <strong>Кабінет створено, ви вже увійшли</strong>
        Ми надіслали лист на <b>{email}</b>. Перейдіть за посиланням у ньому, щоб підтвердити email.
      </p>
      <Link href={next} className="btn">
        {next === "/account" ? "Перейти до кабінету" : "Продовжити"}
      </Link>
    </div>
  );
}
