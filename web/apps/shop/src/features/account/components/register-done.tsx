import Link from "next/link";

export function RegisterDone({ email, next, mailDelivers }: { email: string; next: string; mailDelivers: boolean }) {
  return (
    <div className="auth__done">
      <p className="notice notice--ok">
        <strong>Кабінет створено, ви вже увійшли</strong>
        {mailDelivers ? (
          <>
            Ми надіслали лист на <b>{email}</b>. Перейдіть за посиланням у ньому, щоб підтвердити email.
          </>
        ) : (
          "Листи з сайту поки не надсилаються, тому підтвердити email зараз не вийде."
        )}
      </p>
      <Link href={next} className="btn">
        {next === "/account" ? "Перейти до кабінету" : "Продовжити"}
      </Link>
    </div>
  );
}
