import { createFileRoute } from "@tanstack/react-router";
import AnalyzePage from "@/app/app/dashboard/analyze/page";

export const Route = createFileRoute("/app/dashboard/analyze")({
  component: AnalyzePage,
});
