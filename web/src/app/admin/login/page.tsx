import type { Metadata } from "next";
import { Suspense } from "react";
import { sized } from "@/lib/images";
import { pagePhotos } from "@/lib/stand-in-photos";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вхід" };

/** Вхід для працівників у стилі вітрини: фото першого екрана, біла картка з жовтою смугою зверху. */
export default function LoginPage() {
  return (
    <main id="main" className="admin-login">
      <img {...sized(pagePhotos.hero.url, "100vw", 960)} alt="" width={1600} height={1067} className="admin-login__photo" decoding="async" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
