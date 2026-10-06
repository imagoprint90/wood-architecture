import { FormField, inputClass } from "@/components/ui/Form";
import { ROLE_LABELS, type AppRole, type Employee } from "@/lib/types";
import { DEFAULT_REPORT_DAYS_BACK } from "@/lib/workdays";

export const ROLE_HINT =
  "Administrator ma dostęp do wszystkiego. Raportujący widzi i dodaje wyłącznie własne raporty czasu pracy.";

export function PersonFields({ employee }: { employee?: Employee }) {
  return (
    <>
      <FormField label="Imię" htmlFor="first_name" required>
        <input
          id="first_name"
          name="first_name"
          required
          defaultValue={employee?.first_name}
          className={inputClass}
        />
      </FormField>
      <FormField label="Nazwisko" htmlFor="last_name">
        <input id="last_name" name="last_name" defaultValue={employee?.last_name} className={inputClass} />
      </FormField>
      <FormField label="Stanowisko" htmlFor="position">
        <input id="position" name="position" defaultValue={employee?.position ?? ""} className={inputClass} />
      </FormField>
      <FormField label="Telefon" htmlFor="phone">
        <input id="phone" name="phone" type="tel" defaultValue={employee?.phone ?? ""} className={inputClass} />
      </FormField>
      <FormField label="Stawka godzinowa (zł)" htmlFor="hourly_rate">
        <input
          id="hourly_rate"
          name="hourly_rate"
          type="text"
          inputMode="decimal"
          placeholder="np. 35 lub 42,50"
          defaultValue={employee?.hourly_rate ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Raportowanie wstecz (dni robocze)" htmlFor="report_days_back" required>
        <input
          id="report_days_back"
          name="report_days_back"
          type="number"
          min={0}
          max={365}
          step={1}
          required
          defaultValue={employee?.report_days_back ?? DEFAULT_REPORT_DAYS_BACK}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">
          Ile dni roboczych wstecz ta osoba może złożyć raport. 1 = do końca następnego dnia roboczego,
          0 = tylko za bieżący dzień. Nie dotyczy administratora.
        </p>
      </FormField>
    </>
  );
}

// `prefix` odróżnia identyfikatory pól, gdy na stronie są dwa formularze naraz.
export function CredentialFields({ prefix = "" }: { prefix?: string }) {
  return (
    <>
      <FormField label="Rola" htmlFor={`${prefix}role`} required>
        <RoleSelect id={`${prefix}role`} defaultValue="pracownik" />
      </FormField>
      <FormField label="Adres e-mail (login)" htmlFor={`${prefix}email`} required>
        <input
          id={`${prefix}email`}
          name="email"
          type="email"
          required
          autoComplete="off"
          className={inputClass}
        />
      </FormField>
      <FormField label="Hasło startowe (min. 8 znaków)" htmlFor={`${prefix}password`} required>
        <input
          id={`${prefix}password`}
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          className={inputClass}
        />
      </FormField>
    </>
  );
}

export function RoleSelect({ id, defaultValue }: { id: string; defaultValue: AppRole }) {
  return (
    <select id={id} name="role" defaultValue={defaultValue} className={inputClass}>
      {Object.entries(ROLE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

// Nagłówek grupy pól w formularzu, z linią oddzielającą od poprzedniej grupy.
export function FieldGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-t border-border pt-4 text-xs font-semibold tracking-wider text-muted uppercase col-span-full">
      {children}
    </h3>
  );
}
