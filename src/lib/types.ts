export type AppRole = "admin" | "pracownik";
export type ProjectStatus = "planowana" | "w_toku" | "wstrzymana" | "zakonczona";
export type TimeEntryStatus = "zgloszony" | "zatwierdzony" | "odrzucony";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  pracownik: "Raportujący",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planowana: "Planowana",
  w_toku: "W toku",
  wstrzymana: "Wstrzymana",
  zakonczona: "Zakończona",
};

export const TIME_ENTRY_STATUS_LABELS: Record<TimeEntryStatus, string> = {
  zgloszony: "Zgłoszony",
  zatwierdzony: "Zatwierdzony",
  odrzucony: "Odrzucony",
};

// Wiersze w kształcie zwracanym przez Supabase (snake_case).
export interface Employee {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  position: string | null;
  hourly_rate: number | null;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

// Etap prac (w bazie: tabela work_categories).
export interface WorkCategory {
  id: string;
  name: string;
  sort_order?: number;
  is_archived?: boolean;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  work_category_id: string | null;
  work_date: string;
  hours: number;
  description: string | null;
  status: TimeEntryStatus;
  hourly_rate_snapshot: number | null;
  projects: { name: string } | null;
  employees: { first_name: string; last_name: string } | null;
  work_categories: { name: string } | null;
}

export type ActionState = { ok: boolean; error?: string } | null;
