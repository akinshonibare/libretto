"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PAOLA_WELCOMED_COOKIE } from "@/lib/paola-welcome";

export async function dismissPaolaWelcomeAction(): Promise<void> {
  const store = await cookies();
  store.set(PAOLA_WELCOMED_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/");
}
