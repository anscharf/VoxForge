declare module "docx" {
  export class Document {
    constructor(options: Record<string, unknown>);
  }
  export class Paragraph {
    constructor(options?: Record<string, unknown>);
  }
  export class TextRun {
    constructor(options: string | Record<string, unknown>);
  }
  export class Footer {
    constructor(options: Record<string, unknown>);
  }
  export const HeadingLevel: {
    HEADING_1: string;
    HEADING_2: string;
    HEADING_3: string;
  };
  export const AlignmentType: {
    CENTER: string;
    LEFT: string;
    RIGHT: string;
    JUSTIFIED: string;
  };
  export const BorderStyle: {
    SINGLE: string;
    DOUBLE: string;
    NONE: string;
  };
  export const NumberFormat: {
    DECIMAL: string;
  };
  export class PageBreak {}
  export const PageNumber: {
    CURRENT: string;
    TOTAL_PAGES: string;
  };
  export const Packer: {
    toBlob(doc: Document): Promise<Blob>;
    toBuffer(doc: Document): Promise<Buffer>;
  };
}
