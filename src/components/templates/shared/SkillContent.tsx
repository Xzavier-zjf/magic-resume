import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { normalizeRichTextContent } from "@/lib/richText";
import { GlobalSettings } from "@/types/resume";

interface SkillContentProps {
  skill?: string;
  globalSettings?: GlobalSettings;
  className?: string;
  baseFontSize?: number;
}

const SkillContent = ({
  skill,
  globalSettings,
  className,
  baseFontSize = 14,
}: SkillContentProps) => {
  const isColumns = globalSettings?.skillLayout === "columns";

  return (
    <motion.div
      className={cn("resume-skill-content", className)}
      data-skill-layout={isColumns ? "columns" : "single"}
      layout="position"
      style={{
        fontSize: `${globalSettings?.baseFontSize || baseFontSize}px`,
        lineHeight: globalSettings?.lineHeight || 1.6,
      }}
      dangerouslySetInnerHTML={{ __html: normalizeRichTextContent(skill) }}
    />
  );
};

export default SkillContent;
