import { motion } from "framer-motion";
import SectionTitle from "./SectionTitle";
import SectionWrapper from "../../shared/SectionWrapper";
import { GlobalSettings } from "@/types/resume";
import SkillContent from "../../shared/SkillContent";

interface SkillSectionProps {
  skill?: string;
  globalSettings?: GlobalSettings;
  showTitle?: boolean;
}

const SkillSection = ({ skill, globalSettings, showTitle = true }: SkillSectionProps) => {
  return (
    <SectionWrapper sectionId="skills" className="w-full" style={{ marginTop: `${globalSettings?.sectionSpacing || 32}px` }}>
      <SectionTitle type="skills" globalSettings={globalSettings} showTitle={showTitle} />
      <motion.div style={{ marginTop: `${globalSettings?.paragraphSpacing}px` }}>
        <SkillContent
          skill={skill}
          globalSettings={globalSettings}
          className="text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-strong:font-bold prose-ul:my-1 prose-li:my-0.5 [&>ul]:pl-4 marker:text-black"
        />
      </motion.div>
    </SectionWrapper>
  );
};

export default SkillSection;
