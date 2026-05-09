"use server";

import { revalidatePath } from "next/cache";
import { writeThemeCookie } from "@/lib/theme-cookie";
import { DEFAULT_THEME, isMode, isPalette, isType } from "@/lib/themes";

export async function updateThemeAction(formData: FormData) {
  const palette = formData.get("palette");
  const mode = formData.get("mode");
  const type = formData.get("type");

  await writeThemeCookie({
    palette: typeof palette === "string" && isPalette(palette) ? palette : DEFAULT_THEME.palette,
    mode: typeof mode === "string" && isMode(mode) ? mode : DEFAULT_THEME.mode,
    type: typeof type === "string" && isType(type) ? type : DEFAULT_THEME.type,
  });

  revalidatePath("/", "layout");
}
