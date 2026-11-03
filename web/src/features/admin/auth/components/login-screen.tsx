import { Suspense } from "react";
import { sized } from "@/shared/lib/images";
import { pagePhotos } from "@/shared/lib/stand-in-photos";
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <main id="main" className="admin-login">
      <img {...sized(pagePhotos.hero.url, "100vw", 960)} alt="" width={1600} height={1067} className="admin-login__photo" decoding="async" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
