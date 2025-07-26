// Type definitions for html2pdf.js
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; [key: string]: unknown };
    jsPDF?: { unit?: string; format?: string | [number, number]; orientation?: string; [key: string]: unknown };
    pagebreak?: { mode?: string | string[]; before?: string; after?: string; avoid?: string };
  }

  interface Html2Pdf {
    from(element: HTMLElement): Html2Pdf;
    set(options: Html2PdfOptions): Html2Pdf;
    save(): Promise<void>;
    output(type: string): Promise<Blob | string>;
    outputPdf(type?: string): Promise<Blob | string>;
    then<T = Html2Pdf, U = never>(onFulfilled?: (value: Html2Pdf) => T | PromiseLike<T>, onRejected?: (reason: unknown) => U | PromiseLike<U>): Promise<T | U>;
  }

  function html2pdf(): Html2Pdf;
  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Html2Pdf;

  export = html2pdf;
}