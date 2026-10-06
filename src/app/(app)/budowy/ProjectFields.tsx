import { FormField, inputClass, textareaClass } from "@/components/ui/Form";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";

export function ProjectFields({ project }: { project?: Project }) {
  return (
    <>
      <FormField label="Nazwa budowy" htmlFor="name" required>
        <input id="name" name="name" required defaultValue={project?.name} className={inputClass} />
      </FormField>
      <FormField label="Status" htmlFor="status" required>
        <select id="status" name="status" defaultValue={project?.status ?? "w_toku"} className={inputClass}>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Adres" htmlFor="address">
        <input id="address" name="address" defaultValue={project?.address ?? ""} className={inputClass} />
      </FormField>
      <FormField label="Inwestor / klient" htmlFor="client_name">
        <input
          id="client_name"
          name="client_name"
          defaultValue={project?.client_name ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data rozpoczęcia" htmlFor="start_date">
        <input
          id="start_date"
          name="start_date"
          type="date"
          defaultValue={project?.start_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data zakończenia" htmlFor="end_date">
        <input
          id="end_date"
          name="end_date"
          type="date"
          defaultValue={project?.end_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Uwagi" htmlFor="notes" full>
        <textarea id="notes" name="notes" rows={3} defaultValue={project?.notes ?? ""} className={textareaClass} />
      </FormField>
    </>
  );
}
