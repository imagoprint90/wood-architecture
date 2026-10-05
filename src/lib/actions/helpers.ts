import { z } from "zod";

// Puste pole formularza -> null (zamiast pustego napisu w bazie).
export function textOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

// Liczba z formularza — akceptuje przecinek dziesiętny ("7,5"). Puste pole -> null,
// nieprawidłowa wartość -> NaN (odrzuci ją walidacja zod).
export function parseDecimal(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (text === "") return null;
  return Number(text);
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Nieprawidłowa data.");

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Nieprawidłowe dane.";
}
