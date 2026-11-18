import type { components } from "@polivalko/shared/api/schema";
import { postLogin, postLogout, postRegister } from "../api/client";
import { forgetCsrf, withCsrf } from "./csrf";
import { setSignedIn, setSignedOut } from "./session-store";

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

export async function signOut(): Promise<boolean> {
  try {
    const { response } = await withCsrf((h) => postLogout(h));
    if (!response.ok && response.status !== 401) return false;
  } catch {
    return false;
  }
  forgetCsrf();
  setSignedOut();
  return true;
}

export function sessionEnded() {
  forgetCsrf();
  setSignedOut();
}
