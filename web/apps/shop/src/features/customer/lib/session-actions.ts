import type { components } from "@polivalko/shared/api/schema";
import { postLogin, postLogout, postRegister } from "../api/client";
import { forgetCsrf, withAccountCsrf, withCsrf } from "./csrf";
import { getSession, refreshSessionAcrossTabs, setSignedIn, setSignedOut } from "./session-store";

type S = components["schemas"];

export async function signIn(body: S["CustomerLoginRequest"]) {
  const result = await withCsrf((h) => postLogin(h, body));
  if (result.data) {
    forgetCsrf();
    setSignedIn(result.data);
  }
  return result;
}

export async function signUp(body: S["RegisterCustomerRequest"]) {
  const result = await withCsrf((h) => postRegister(h, body));
  if (result.data) {
    forgetCsrf();
    setSignedIn(result.data);
  }
  return result;
}

export async function signOut(owner: string | null): Promise<boolean> {
  try {
    const { response } = await withAccountCsrf(postLogout, owner);
    if (!response.ok && response.status !== 401) return false;
  } catch {
    if (getSession().status !== "guest") return false;
  }
  forgetCsrf();
  if (getSession().status !== "guest") setSignedOut();
  return true;
}

export function refreshAfterPasswordReset() {
  forgetCsrf();
  return refreshSessionAcrossTabs();
}
