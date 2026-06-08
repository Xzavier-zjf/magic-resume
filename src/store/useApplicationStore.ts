import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ApplicationRecord, ApplicationStatus } from "@/types/resume";
import { generateUUID } from "@/utils/uuid";

interface ApplicationStore {
  applications: Record<string, ApplicationRecord>;
  addApplication: (
    application: Omit<ApplicationRecord, "id" | "createdAt" | "updatedAt">
  ) => string;
  updateApplication: (
    id: string,
    updates: Partial<Omit<ApplicationRecord, "id" | "createdAt">>
  ) => void;
  deleteApplication: (id: string) => void;
  getApplicationsByStatus: (status?: ApplicationStatus | "all") => ApplicationRecord[];
}

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending",
  "applied",
  "written",
  "interview",
  "offer",
  "rejected",
  "archived",
];

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set, get) => ({
      applications: {},
      addApplication: (application) => {
        const id = generateUUID();
        const now = new Date().toISOString();
        const nextApplication: ApplicationRecord = {
          ...application,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          applications: {
            ...state.applications,
            [id]: nextApplication,
          },
        }));

        return id;
      },
      updateApplication: (id, updates) => {
        set((state) => {
          const current = state.applications[id];
          if (!current) return state;

          return {
            applications: {
              ...state.applications,
              [id]: {
                ...current,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      deleteApplication: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.applications;
          return { applications: rest };
        });
      },
      getApplicationsByStatus: (status = "all") => {
        const applications = Object.values(get().applications).sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime()
        );
        return status === "all"
          ? applications
          : applications.filter((item) => item.status === status);
      },
    }),
    {
      name: "application-storage",
    }
  )
);
