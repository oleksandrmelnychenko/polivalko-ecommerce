import { Suspense } from "react";
import { sized } from "@polivalko/shared/lib/images";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <main id="main" className="console-login">
      <img {...sized(pagePhotos.hero.url, "100vw", 960)} alt="" width={1600} height={1067} className="console-login__photo" decoding="async" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
