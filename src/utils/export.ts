import { toast } from "sonner";
import { PDF_EXPORT_CONFIG } from "@/config";
import { normalizeFontFamily } from "@/utils/fonts";
import { ResumeData } from "@/types/resume";
import { generateResumeMarkdown, ResumeMarkdownOptions } from "@/utils/markdown";
import { exportResumeToBrowserPrint } from "@/utils/print";

const INVALID_FILE_NAME_CHAR_REGEX = /[\\/:*?"<>|]/g;

const getSafeFileName = (title?: string) => {
  const normalized = (title || "resume")
    .trim()
    .replace(INVALID_FILE_NAME_CHAR_REGEX, "_")
    .replace(/\s+/g, " ");

  return normalized || "resume";
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
};

const optimizeImages = async (element: HTMLElement) => {
  const startTime = performance.now();
  const images = element.getElementsByTagName("img");

  const imagePromises = Array.from(images)
    .filter((img) => !img.src.startsWith("data:"))
    .map(async (img) => {
      try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        return new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            img.src = reader.result as string;
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Image conversion error:", error);
        return Promise.resolve();
      }
    });

  await Promise.all(imagePromises);
  console.log(`Image processing took ${performance.now() - startTime}ms`);
};

const normalizePdfElementForExport = (
  element: HTMLElement,
  pagePadding: number,
  fontFamily?: string
) => {
  const clonedElement = element.cloneNode(true) as HTMLElement;
  const selectedFontFamily = normalizeFontFamily(fontFamily);
  const transformValue = clonedElement.style.transform || "";
  const scaleMatch = transformValue.match(/scale\(([\d.]+)\)/);

  if (scaleMatch) {
    const scale = Number(scaleMatch[1]);
    if (Number.isFinite(scale) && scale > 0 && scale < 1) {
      clonedElement.style.removeProperty("transform");
      clonedElement.style.removeProperty("transform-origin");
      clonedElement.style.setProperty("width", `${100 / scale}%`, "important");
      clonedElement.style.setProperty("zoom", String(scale));
    }
  }

  clonedElement.style.setProperty("width", "210mm", "important");
  clonedElement.style.setProperty("min-width", "210mm", "important");
  clonedElement.style.setProperty("min-height", "297mm", "important");
  clonedElement.style.setProperty("padding", `${pagePadding}px`, "important");
  clonedElement.style.setProperty("margin", "0", "important");
  clonedElement.style.setProperty("box-sizing", "border-box");
  clonedElement.style.setProperty("font-family", selectedFontFamily, "important");
  clonedElement.style.setProperty("background", "#ffffff", "important");
  clonedElement.style.setProperty("box-shadow", "none", "important");

  clonedElement.querySelectorAll<HTMLElement>(".page-break-line").forEach((line) => {
    line.style.display = "none";
  });

  return clonedElement;
};

const createPdfExportHost = (element: HTMLElement) => {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  host.appendChild(element);
  document.body.appendChild(host);
  return host;
};

const waitForRenderableAssets = async (element: HTMLElement) => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const images = Array.from(element.getElementsByTagName("img"));
  await Promise.all(
    images
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
  );
};

const exportElementToLocalPdf = async (
  element: HTMLElement,
  fileName: string
) => {
  const { default: html2pdf } = await import("html2pdf.js");
  const options = {
    margin: 0,
    filename: fileName,
    image: {
      type: "jpeg",
      quality: PDF_EXPORT_CONFIG.IMAGE_QUALITY
    },
    html2canvas: {
      scale: PDF_EXPORT_CONFIG.CANVAS_SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["img", "tr"]
    }
  };

  await html2pdf().set(options).from(element).save(fileName);
};

export interface ExportToPdfOptions {
  elementId: string;
  title: string;
  pagePadding: number;
  fontFamily?: string;
  onStart?: () => void;
  onEnd?: () => void;
  successMessage?: string;
  errorMessage?: string;
  fallbackMessage?: string;
}

interface ExportResumeFileOptions {
  resume?: ResumeData | null;
  title?: string;
  onStart?: () => void;
  onEnd?: () => void;
  successMessage?: string;
  errorMessage?: string;
}

interface ExportResumeMarkdownOptions extends ExportResumeFileOptions {
  markdownOptions?: ResumeMarkdownOptions;
}

export const exportResumeAsJson = ({
  resume,
  title,
  onStart,
  onEnd,
  successMessage,
  errorMessage
}: ExportResumeFileOptions) => {
  onStart?.();

  try {
    if (!resume) {
      throw new Error("No active resume");
    }

    const json = JSON.stringify(resume, null, 2);
    const fileName = `${getSafeFileName(title || resume.title)}.json`;
    downloadTextFile(json, fileName, "application/json;charset=utf-8");
    if (successMessage) toast.success(successMessage);
  } catch (error) {
    console.error("JSON export error:", error);
    if (errorMessage) toast.error(errorMessage);
  } finally {
    onEnd?.();
  }
};

export const exportResumeAsMarkdown = ({
  resume,
  title,
  onStart,
  onEnd,
  successMessage,
  errorMessage,
  markdownOptions
}: ExportResumeMarkdownOptions) => {
  onStart?.();

  try {
    if (!resume) {
      throw new Error("No active resume");
    }

    const markdown = generateResumeMarkdown(resume, markdownOptions);
    const fileName = `${getSafeFileName(title || resume.title)}.md`;
    downloadTextFile(markdown, fileName, "text/markdown;charset=utf-8");
    if (successMessage) toast.success(successMessage);
  } catch (error) {
    console.error("Markdown export error:", error);
    if (errorMessage) toast.error(errorMessage);
  } finally {
    onEnd?.();
  }
};

export const exportToPdf = async ({
  elementId,
  title,
  pagePadding,
  fontFamily,
  onStart,
  onEnd,
  successMessage,
  errorMessage,
  fallbackMessage
}: ExportToPdfOptions) => {
  const exportStartTime = performance.now();
  onStart?.();

  try {
    const pdfElement = document.querySelector<HTMLElement>(`#${elementId}`);
    if (!pdfElement) {
      throw new Error(`PDF element #${elementId} not found`);
    }

    const clonedElement = normalizePdfElementForExport(
      pdfElement,
      pagePadding,
      fontFamily
    );
    const estimatedSize = clonedElement.outerHTML.length;
    if (estimatedSize > PDF_EXPORT_CONFIG.MAX_CONTENT_SIZE) {
      throw new Error("PDF content is too large");
    }

    const fileName = `${getSafeFileName(title)}.pdf`;
    let host: HTMLElement | null = null;
    try {
      await optimizeImages(clonedElement);
      host = createPdfExportHost(clonedElement);
      await waitForRenderableAssets(clonedElement);
      await exportElementToLocalPdf(clonedElement, fileName);
    } finally {
      host?.remove();
    }

    if (successMessage) toast.success(successMessage);
    console.log(`Total export took ${performance.now() - exportStartTime}ms`);
  } catch (error) {
    console.error("Export error:", error);
    const pdfElement = document.querySelector<HTMLElement>(`#${elementId}`);
    if (pdfElement) {
      toast.warning(
        fallbackMessage ||
          "Local PDF export failed. Browser print export has been opened instead."
      );
      await exportResumeToBrowserPrint(pdfElement, pagePadding, fontFamily);
    } else if (errorMessage) {
      toast.error(errorMessage);
    }
  } finally {
    onEnd?.();
  }
};
