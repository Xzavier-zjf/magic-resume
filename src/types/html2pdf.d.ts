declare module "html2pdf.js" {
  type Html2PdfOptions = Record<string, unknown>;

  interface Html2PdfWorker extends Promise<void> {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(source: HTMLElement | string): Html2PdfWorker;
    save(filename?: string): Promise<void>;
  }

  interface Html2PdfFactory {
    (): Html2PdfWorker;
    (source: HTMLElement | string, options?: Html2PdfOptions): Html2PdfWorker;
  }

  const html2pdf: Html2PdfFactory;
  export default html2pdf;
}
