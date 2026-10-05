import { ActionForm } from "@/components/ui/ActionForm";
import { FormField, inputClass } from "@/components/ui/Form";
import { saveProjectAction } from "@/lib/actions/project-actions";
import { requireManager } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";

export default async function BudowyPage() {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("projects").select("*").order("name");
  if (error) throw new Error(error.message);
  const projects = (data ?? []) as Project[];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h1 className="text-base font-semibold">Nowa budowa</h1>
        <ProjectForm />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">Budowy ({projects.length})</h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nie dodano jeszcze żadnej budowy.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {projects.map((project) => (
              <li key={project.id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{project.name}</span>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                    <span className="text-xs text-muted">
                      {[
                        project.address,
                        project.client_name,
                        project.start_date ? `od ${formatDate(project.start_date)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </summary>
                  <ProjectForm project={project} />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectForm({ project }: { project?: Project }) {
  // Sufiks odróżnia identyfikatory pól, gdy na stronie jest kilka formularzy naraz.
  const suffix = project?.id ?? "new";
  return (
    <ActionForm
      action={saveProjectAction}
      submitLabel={project ? "Zapisz zmiany" : "Dodaj budowę"}
      className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {project && <input type="hidden" name="id" value={project.id} />}
      <FormField label="Nazwa budowy" htmlFor={`name-${suffix}`} required>
        <input
          id={`name-${suffix}`}
          name="name"
          required
          defaultValue={project?.name}
          className={inputClass}
        />
      </FormField>
      <FormField label="Status" htmlFor={`status-${suffix}`} required>
        <select
          id={`status-${suffix}`}
          name="status"
          defaultValue={project?.status ?? "w_toku"}
          className={inputClass}
        >
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Adres" htmlFor={`address-${suffix}`}>
        <input
          id={`address-${suffix}`}
          name="address"
          defaultValue={project?.address ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Inwestor / klient" htmlFor={`client-${suffix}`}>
        <input
          id={`client-${suffix}`}
          name="client_name"
          defaultValue={project?.client_name ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data rozpoczęcia" htmlFor={`start-${suffix}`}>
        <input
          id={`start-${suffix}`}
          name="start_date"
          type="date"
          defaultValue={project?.start_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Data zakończenia" htmlFor={`end-${suffix}`}>
        <input
          id={`end-${suffix}`}
          name="end_date"
          type="date"
          defaultValue={project?.end_date ?? ""}
          className={inputClass}
        />
      </FormField>
      <FormField label="Uwagi" htmlFor={`notes-${suffix}`} full>
        <textarea
          id={`notes-${suffix}`}
          name="notes"
          rows={2}
          defaultValue={project?.notes ?? ""}
          className={inputClass}
        />
      </FormField>
    </ActionForm>
  );
}
