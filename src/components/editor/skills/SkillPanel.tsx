import { useResumeStore } from "@/store/useResumeStore";
import { cn } from "@/lib/utils";
import Field from "../Field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns2, Rows3 } from "lucide-react";
import { useTranslations } from "@/i18n/compat/client";
import { GlobalSettings } from "@/types/resume";

const SkillPanel = () => {
  const { activeResume, updateSkillContent, updateGlobalSettings } =
    useResumeStore();
  const { skillContent, globalSettings } = activeResume || {};
  const t = useTranslations("workbench.skillPanel");
  const skillLayout = globalSettings?.skillLayout || "single";
  const handleChange = (value: string) => {
    updateSkillContent(value);
  };

  const handleLayoutChange = (value: string) => {
    updateGlobalSettings({
      skillLayout: value as NonNullable<GlobalSettings["skillLayout"]>,
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        "bg-card",
        "border-border"
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("layout.title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("layout.description")}
          </p>
        </div>
        <Tabs value={skillLayout} onValueChange={handleLayoutChange}>
          <TabsList className="h-9">
            <TabsTrigger value="single" className="h-7 gap-1.5 px-3">
              <Rows3 className="h-3.5 w-3.5" />
              {t("layout.single")}
            </TabsTrigger>
            <TabsTrigger value="columns" className="h-7 gap-1.5 px-3">
              <Columns2 className="h-3.5 w-3.5" />
              {t("layout.columns")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Field
        value={skillContent}
        onChange={handleChange}
        type="editor"
        placeholder={t("placeholder")}
      />
    </div>
  );
};

export default SkillPanel;
