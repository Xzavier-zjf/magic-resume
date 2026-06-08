import { TargetRolePreset } from "@/types/resume";

export const TARGET_ROLE_PRESETS: TargetRolePreset[] = [
  {
    id: "qa",
    labelZh: "测试工程师",
    labelEn: "QA Engineer",
    valueZh: "测试工程师",
    valueEn: "QA Engineer",
  },
  {
    id: "frontend",
    labelZh: "前端工程师",
    labelEn: "Frontend Engineer",
    valueZh: "前端工程师",
    valueEn: "Frontend Engineer",
  },
  {
    id: "backend",
    labelZh: "后端工程师",
    labelEn: "Backend Engineer",
    valueZh: "后端工程师",
    valueEn: "Backend Engineer",
  },
  {
    id: "fullstack",
    labelZh: "全栈工程师",
    labelEn: "Full-stack Engineer",
    valueZh: "全栈工程师",
    valueEn: "Full-stack Engineer",
  },
  {
    id: "java",
    labelZh: "Java 工程师",
    labelEn: "Java Engineer",
    valueZh: "Java 工程师",
    valueEn: "Java Engineer",
  },
  {
    id: "devops",
    labelZh: "运维 / DevOps",
    labelEn: "DevOps Engineer",
    valueZh: "运维 / DevOps 工程师",
    valueEn: "DevOps Engineer",
  },
  {
    id: "pm",
    labelZh: "产品经理",
    labelEn: "Product Manager",
    valueZh: "产品经理",
    valueEn: "Product Manager",
  },
];

export const getTargetRoleLabel = (
  preset: TargetRolePreset,
  locale = "zh"
) => (locale === "en" ? preset.labelEn : preset.labelZh);

export const getTargetRoleValue = (
  preset: TargetRolePreset,
  locale = "zh"
) => (locale === "en" ? preset.valueEn : preset.valueZh);
