import { FormEvent, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  Filter,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/compat/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  APPLICATION_STATUSES,
  useApplicationStore,
} from "@/store/useApplicationStore";
import { useResumeStore } from "@/store/useResumeStore";
import { ApplicationRecord, ApplicationStatus } from "@/types/resume";

type FilterStatus = ApplicationStatus | "all";

type ApplicationFormState = {
  company: string;
  position: string;
  status: ApplicationStatus;
  resumeId: string;
  appliedAt: string;
  interviewAt: string;
  jobDescription: string;
  notes: string;
};

const statusTone: Record<ApplicationStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  applied: "bg-blue-50 text-blue-700 border-blue-200",
  written: "bg-violet-50 text-violet-700 border-violet-200",
  interview: "bg-amber-50 text-amber-700 border-amber-200",
  offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  archived: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const today = () => {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const createEmptyForm = (): ApplicationFormState => ({
  company: "",
  position: "",
  status: "pending",
  resumeId: "none",
  appliedAt: today(),
  interviewAt: "",
  jobDescription: "",
  notes: "",
});

const formFromRecord = (record: ApplicationRecord): ApplicationFormState => ({
  company: record.company,
  position: record.position,
  status: record.status,
  resumeId: record.resumeId || "none",
  appliedAt: record.appliedAt || "",
  interviewAt: record.interviewAt || "",
  jobDescription: record.jobDescription,
  notes: record.notes || "",
});

const ApplicationsPage = () => {
  const t = useTranslations();
  const { resumes } = useResumeStore();
  const {
    applications,
    addApplication,
    updateApplication,
    deleteApplication,
    getApplicationsByStatus,
  } = useApplicationStore();
  const resumeList = useMemo(
    () =>
      Object.values(resumes).sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime()
      ),
    [resumes]
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ApplicationFormState>(createEmptyForm);

  const applicationList = useMemo(() => {
    return getApplicationsByStatus(filterStatus);
  }, [applications, filterStatus, getApplicationsByStatus]);

  const counts = useMemo(() => {
    const result: Record<FilterStatus, number> = {
      all: Object.keys(applications).length,
      pending: 0,
      applied: 0,
      written: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      archived: 0,
    };
    Object.values(applications).forEach((item) => {
      result[item.status] += 1;
    });
    return result;
  }, [applications]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (record: ApplicationRecord) => {
    setEditingId(record.id);
    setForm(formFromRecord(record));
    setDialogOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.company.trim() || !form.position.trim()) {
      toast.error(t("dashboard.applications.toast.required"));
      return;
    }

    const payload = {
      company: form.company.trim(),
      position: form.position.trim(),
      status: form.status,
      resumeId: form.resumeId === "none" ? undefined : form.resumeId,
      appliedAt: form.appliedAt || undefined,
      interviewAt: form.interviewAt || undefined,
      jobDescription: form.jobDescription.trim(),
      notes: form.notes.trim() || undefined,
    };

    if (editingId) {
      updateApplication(editingId, payload);
      toast.success(t("dashboard.applications.toast.updated"));
    } else {
      addApplication(payload);
      toast.success(t("dashboard.applications.toast.created"));
    }

    setDialogOpen(false);
  };

  const setFormField = <K extends keyof ApplicationFormState>(
    key: K,
    value: ApplicationFormState[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  return (
    <ScrollArea className="h-[calc(100vh-2rem)] w-full">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              {t("dashboard.applications.kicker")}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {t("dashboard.applications.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("dashboard.applications.description")}
            </p>
          </div>
          <Button type="button" onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("dashboard.applications.actions.add")}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {(["all", ...APPLICATION_STATUSES] as FilterStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                filterStatus === status
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {status === "all"
                    ? t("dashboard.applications.status.all")
                    : t(`dashboard.applications.status.${status}`)}
                </span>
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="mt-2 text-xl font-semibold">{counts[status]}</div>
            </button>
          ))}
        </div>

        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("dashboard.applications.list.title")}
            </CardTitle>
            <CardDescription>
              {t("dashboard.applications.list.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {applicationList.length ? (
              <div className="divide-y rounded-lg border">
                {applicationList.map((application) => {
                  const resume = application.resumeId
                    ? resumes[application.resumeId]
                    : undefined;

                  return (
                    <div
                      key={application.id}
                      className="grid gap-3 p-4 lg:grid-cols-[1.2fr,1fr,1fr,auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">
                            {application.company}
                          </h3>
                          <Badge
                            variant="outline"
                            className={statusTone[application.status]}
                          >
                            {t(`dashboard.applications.status.${application.status}`)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {application.position}
                        </p>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="line-clamp-2">
                          {resume?.title ||
                            t("dashboard.applications.list.noResume")}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {application.appliedAt && (
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4" />
                            {t("dashboard.applications.fields.appliedAt")}:{" "}
                            {application.appliedAt}
                          </div>
                        )}
                        {application.interviewAt && (
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4" />
                            {t("dashboard.applications.fields.interviewAt")}:{" "}
                            {application.interviewAt}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(application)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            deleteApplication(application.id);
                            toast.success(t("dashboard.applications.toast.deleted"));
                          }}
                          className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("common.delete")}
                        </Button>
                      </div>

                      {(application.jobDescription || application.notes) && (
                        <div className="lg:col-span-4 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-2">
                          {application.jobDescription && (
                            <p className="line-clamp-3">
                              {application.jobDescription}
                            </p>
                          )}
                          {application.notes && (
                            <p className="line-clamp-3">{application.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
                <BriefcaseBusiness className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 text-lg font-semibold">
                  {t("dashboard.applications.empty.title")}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {t("dashboard.applications.empty.description")}
                </p>
                <Button type="button" onClick={openCreateDialog} className="mt-5 gap-2">
                  <Plus className="h-4 w-4" />
                  {t("dashboard.applications.actions.add")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>
                {editingId
                  ? t("dashboard.applications.dialog.editTitle")
                  : t("dashboard.applications.dialog.createTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="application-company">
                    {t("dashboard.applications.fields.company")}
                  </Label>
                  <Input
                    id="application-company"
                    value={form.company}
                    onChange={(event) => setFormField("company", event.target.value)}
                    placeholder={t("dashboard.applications.placeholders.company")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="application-position">
                    {t("dashboard.applications.fields.position")}
                  </Label>
                  <Input
                    id="application-position"
                    value={form.position}
                    onChange={(event) => setFormField("position", event.target.value)}
                    placeholder={t("dashboard.applications.placeholders.position")}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("dashboard.applications.fields.status")}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setFormField("status", value as ApplicationStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`dashboard.applications.status.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("dashboard.applications.fields.resume")}</Label>
                  <Select
                    value={form.resumeId}
                    onValueChange={(value) => setFormField("resumeId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("dashboard.applications.fields.noResume")}
                      </SelectItem>
                      {resumeList.map((resume) => (
                        <SelectItem key={resume.id} value={resume.id}>
                          {resume.title || t("dashboard.resumes.untitled")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="application-applied-at">
                    {t("dashboard.applications.fields.appliedAt")}
                  </Label>
                  <Input
                    id="application-applied-at"
                    type="date"
                    value={form.appliedAt}
                    onChange={(event) =>
                      setFormField("appliedAt", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="application-interview-at">
                    {t("dashboard.applications.fields.interviewAt")}
                  </Label>
                  <Input
                    id="application-interview-at"
                    type="date"
                    value={form.interviewAt}
                    onChange={(event) =>
                      setFormField("interviewAt", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="application-jd">
                  {t("dashboard.applications.fields.jobDescription")}
                </Label>
                <Textarea
                  id="application-jd"
                  value={form.jobDescription}
                  onChange={(event) =>
                    setFormField("jobDescription", event.target.value)
                  }
                  placeholder={t("dashboard.applications.placeholders.jobDescription")}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="application-notes">
                  {t("dashboard.applications.fields.notes")}
                </Label>
                <Textarea
                  id="application-notes"
                  value={form.notes}
                  onChange={(event) => setFormField("notes", event.target.value)}
                  placeholder={t("dashboard.applications.placeholders.notes")}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit">{t("common.confirm")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
};

export default ApplicationsPage;
