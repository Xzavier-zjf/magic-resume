import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResumeStore } from "@/store/useResumeStore";
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
} from "framer-motion";
import { ChevronDown, Eye, EyeOff, GripVertical, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import Field from "../Field";
import ThemeModal from "@/components/shared/ThemeModal";
import { useTranslations } from "@/i18n/compat/client";
import { Project } from "@/types/resume";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import AIProjectWriterDialog from "./AIProjectWriterDialog";

interface ProjectEditorProps {
  project: Project;
  onSave: (project: Project) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const ProjectEditor: React.FC<ProjectEditorProps> = ({ project, onSave }) => {
  const t = useTranslations("workbench.projectItem");
  const [aiWriterOpen, setAiWriterOpen] = useState(false);
  const hasProjectLink = Boolean(project.link?.trim());
  const handleChange = (field: keyof Project, value: string) => {
    onSave({
      ...project,
      [field]: value,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAiWriterOpen(true)}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {t("aiWriter.entry")}
        </Button>
      </div>
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t("labels.name")}
            value={project.name}
            onChange={(value) => handleChange("name", value)}
            placeholder={t("placeholders.name")}
          />
          <Field
            label={t("labels.role")}
            value={project.role}
            onChange={(value) => handleChange("role", value)}
            placeholder={t("placeholders.role")}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between font-medium">
            <span className="text-sm text-foreground">{t("labels.link")}</span>
          </div>
          <div className="rounded-lg border border-input bg-background/40 p-3">
            {hasProjectLink && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("labels.linkVisible")}
                </span>
                <Switch
                  checked={project.linkVisible !== false}
                  onCheckedChange={(checked) =>
                    onSave({ ...project, linkVisible: checked })
                  }
                  aria-label={t("labels.linkVisible")}
                />
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("labels.link")}
                </span>
                <Input
                  type="text"
                  value={project.link || ""}
                  onChange={(e) => handleChange("link", e.target.value)}
                  placeholder={t("placeholders.link")}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("labels.linkLabel")}
                </span>
                <Input
                  type="text"
                  value={project.linkLabel || ""}
                  onChange={(e) => handleChange("linkLabel", e.target.value)}
                  placeholder={t("placeholders.linkLabel")}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("hints.linkLabel")}
            </p>
          </div>
        </div>
        <Field
          label={t("labels.date")}
          value={project.date}
          onChange={(value) => handleChange("date", value)}
          type="date-range"
          placeholder={t("placeholders.date")}
          showPresentSwitch={true}
        />
        <Field
          label={t("labels.description")}
          value={project.description}
          onChange={(value) => handleChange("description", value)}
          type="editor"
          placeholder={t("placeholders.description")}
        />
      </div>
      <AIProjectWriterDialog
        open={aiWriterOpen}
        onOpenChange={setAiWriterOpen}
        project={project}
        onApply={onSave}
      />
    </div>
  );
};

const ProjectItem = ({ project }: { project: Project }) => {
  const { updateProjects, deleteProject, setDraggingProjectId } =
    useResumeStore();
  const dragControls = useDragControls();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleVisibilityToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isUpdating) return;

      setIsUpdating(true);
      setTimeout(() => {
        updateProjects({
          ...project,
          visible: !project.visible,
        });
        setIsUpdating(false);
      }, 10);
    },
    [project, updateProjects, isUpdating]
  );

  return (
    <Reorder.Item
      id={project.id}
      value={project}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={() => {
        setDraggingProjectId(null);
      }}
      className={cn(
        "rounded-lg border overflow-hidden flex group",
        "bg-card hover:border-primary/50",
        "border-border"
      )}
    >
      <div
        onPointerDown={(event) => {
          if (expandedId === project.id) return;
          dragControls.start(event);
          setDraggingProjectId(project.id);
        }}
        onPointerUp={() => {
          setDraggingProjectId(null);
        }}
        onPointerCancel={() => {
          setDraggingProjectId(null);
        }}
        className={cn(
          "w-12 flex items-center justify-center border-r shrink-0 touch-none",
          "border-border",
          expandedId === project.id
            ? "cursor-not-allowed"
            : "cursor-grab hover:bg-muted/50"
        )}
      >
        <GripVertical
          className={cn(
            "w-4 h-4",
            "text-muted-foreground",
            expandedId === project.id && "opacity-50",
            "transform transition-transform group-hover:scale-110"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "px-4 py-4 flex items-center justify-between",
            expandedId === project.id && "bg-muted/10",
            "cursor-pointer select-none"
          )}
          onClick={(e) => {
            if (expandedId === project.id) {
              setExpandedId(null);
            } else {
              setExpandedId(project.id);
            }
          }}
        >
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-medium truncate",
                "text-gray-700 dark:text-neutral-200"
              )}
            >
              {project.name || "未命名项目"}
            </h3>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className={cn(
                "text-sm",
                project.visible
                  ? "hover:bg-gray-100 text-gray-500 dark:hover:bg-neutral-800 dark:text-neutral-400"
                  : "hover:bg-gray-100 text-gray-400 dark:hover:bg-neutral-800 dark:text-neutral-600"
              )}
              onClick={handleVisibilityToggle}
            >
              {project.visible ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "text-sm",
                "dark:hover:bg-red-900/50 dark:text-red-400 hover:bg-red-50 text-red-600"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <ThemeModal
              isOpen={deleteDialogOpen}
              title={project.name}
              onClose={() => setDeleteDialogOpen(false)}
              onConfirm={() => {
                deleteProject(project.id);
                setExpandedId(null);
                setDeleteDialogOpen(false);
              }}
            />

            <motion.div
              initial={false}
              animate={{
                rotate: expandedId === project.id ? 180 : 0,
              }}
            >
              <ChevronDown
                className={cn(
                  "w-5 h-5",
                  "dark:text-neutral-400",
                  "text-gray-500"
                )}
              />
            </motion.div>
          </div>
        </div>
        <AnimatePresence>
          {expandedId === project.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className={cn(
                  "px-4 pb-4 space-y-4",
                  "dark:border-neutral-800 border-gray-100"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={cn(
                    "h-px w-full",
                    "dark:bg-neutral-800 bg-gray-100"
                  )}
                />
                <ProjectEditor
                  project={project}
                  onSave={(updatedProject) => {
                    updateProjects(updatedProject);
                  }}
                  onDelete={() => {
                    deleteProject(project.id);
                    setExpandedId(null);
                  }}
                  onCancel={() => setExpandedId(null)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  );
};

export default ProjectItem;
