/**
 * OOXML (WordprocessingML) primitives: XML escaping, the run/paragraph
 * vocabulary the résumé body is built from, shared formatting constants, and
 * the package parts that never vary between résumés.
 *
 * Every run's font block and every dimension below (colors, sizes, margins)
 * was read out of the attached master's `word/document.xml`, so "match the
 * master" is these exact numbers rather than a rebuilt-from-scratch judgment
 * call.
 */

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types";

// -- Escaping ----------------------------------------------------------

/** Escape text for use inside an XML element's content. */
export function xmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape text for use inside a double-quoted XML attribute value. */
export function xmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// -- Runs and paragraphs -------------------------------------------------

export type RunStyle = {
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  underline?: boolean;
  /** Hex, no leading '#'. */
  color?: string;
  /** Half-points. */
  size?: number;
  /** Character spacing, twips. */
  spacing?: number;
};

/**
 * A single run of text. Every run shares the master's font block
 * regardless of style, and gets `xml:space="preserve"` automatically
 * whenever the text has leading or trailing whitespace - callers (the
 * `"  |  "` separator runs, in particular) never have to remember it
 * themselves, and Word would otherwise collapse it away.
 */
export function run(text: string, style: RunStyle = {}): string {
  const rPr = ['<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Calibri" w:cs="Calibri"/>'];
  if (style.bold) rPr.push("<w:b/>");
  if (style.italic) rPr.push("<w:i/>");
  if (style.caps) rPr.push("<w:caps/>");
  if (style.color) rPr.push(`<w:color w:val="${xmlAttr(style.color)}"/>`);
  if (style.spacing !== undefined) rPr.push(`<w:spacing w:val="${style.spacing}"/>`);
  if (style.size !== undefined) {
    rPr.push(`<w:sz w:val="${style.size}"/>`);
    rPr.push(`<w:szCs w:val="${style.size}"/>`);
  }
  if (style.underline) rPr.push('<w:u w:val="single"/>');

  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<w:r><w:rPr>${rPr.join("")}</w:rPr><w:t${preserve}>${xmlText(text)}</w:t></w:r>`;
}

/** A right tab stop, e.g. between a job's title and its right-aligned dates. */
export function tab(): string {
  return "<w:r><w:tab/></w:r>";
}

/** Wraps already-built runs in a hyperlink referencing a relationship id. */
export function hyperlink(relId: string, runs: string): string {
  return `<w:hyperlink r:id="${xmlAttr(relId)}">${runs}</w:hyperlink>`;
}

export type ParagraphOpts = {
  align?: "center";
  keepNext?: boolean;
  bottomBorder?: { size: number; space: number; color: string };
  spacing?: { before?: number; after?: number; line?: number };
  /** Position of a single right-aligned tab stop, twips. */
  rightTabAt?: number;
  /** References the one numbering definition in numbering.xml (always ilvl 0). */
  numId?: number;
  /** Left indent, twips - only ever needed to zero out an inherited one. */
  indentStart?: number;
  style?: "Normal" | "ListParagraph";
};

/** A paragraph built from already-built runs (see `run`, `tab`, `hyperlink`). */
export function paragraph(opts: ParagraphOpts, runs: string[]): string {
  const pPr: string[] = [];
  if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.keepNext) pPr.push("<w:keepNext/>");
  if (opts.numId !== undefined) {
    pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>`);
  }
  if (opts.bottomBorder) {
    const { size, space, color } = opts.bottomBorder;
    pPr.push(
      `<w:pBdr><w:bottom w:val="single" w:sz="${size}" w:space="${space}" w:color="${xmlAttr(color)}"/></w:pBdr>`,
    );
  }
  if (opts.rightTabAt !== undefined) {
    pPr.push(`<w:tabs><w:tab w:val="right" w:pos="${opts.rightTabAt}"/></w:tabs>`);
  }
  if (opts.spacing) {
    const { before, after, line } = opts.spacing;
    const attrs: string[] = [];
    if (before !== undefined) attrs.push(`w:before="${before}"`);
    if (after !== undefined) attrs.push(`w:after="${after}"`);
    if (line !== undefined) attrs.push(`w:line="${line}" w:lineRule="auto"`);
    if (attrs.length > 0) pPr.push(`<w:spacing ${attrs.join(" ")}/>`);
  }
  if (opts.indentStart !== undefined) pPr.push(`<w:ind w:start="${opts.indentStart}"/>`);
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);

  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${runs.join("")}</w:p>`;
}

/**
 * Wraps the body's paragraphs in the document envelope and a fixed `sectPr`
 * (US Letter, the master's margins). The body's own content - everything
 * `resume-docx.ts` builds from `ResumeContent` - never needs to know this
 * wrapper or the page geometry exists.
 */
export function documentXml(bodyParagraphs: string): string {
  return (
    `${XML_DECLARATION}<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>` +
    bodyParagraphs +
    `<w:sectPr><w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/>` +
    `<w:pgMar w:top="${PAGE.top}" w:right="${PAGE.right}" w:bottom="${PAGE.bottom}" w:left="${PAGE.left}"/>` +
    `</w:sectPr></w:body></w:document>`
  );
}

export type Relationship = { id: string; type: string; target: string; targetMode?: "External" };

/** Serializes a package or part relationships file (the `.rels` format). */
export function relationshipsXml(relationships: Relationship[]): string {
  const rels = relationships
    .map((r) => {
      const targetMode = r.targetMode ? ` TargetMode="${r.targetMode}"` : "";
      return `<Relationship Id="${xmlAttr(r.id)}" Type="${xmlAttr(r.type)}" Target="${xmlAttr(r.target)}"${targetMode}/>`;
    })
    .join("");
  return `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELS_NS}">${rels}</Relationships>`;
}

// -- Shared constants -----------------------------------------------------

export const FONT = "Arial";
export const COLOR = { heading: "1F3864", body: "1A1A1A", muted: "595959", rule: "BFC7D4" };
export const SIZE = { name: 40, tagline: 21, small: 18, body: 20, company: 22 };
export const PAGE = { w: 12240, h: 15840, left: 720, right: 720, top: 620, bottom: 560 };
export const RIGHT_TAB = 10800; // page width minus both margins

/** The one numbering definition every bullet (highlights, projects) uses. */
export const BULLET_NUM_ID = 1;

// -- Static package parts --------------------------------------------------

export const CONTENT_TYPES_XML =
  `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES_NS}">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  "</Types>";

export const PACKAGE_RELS_XML = relationshipsXml([
  {
    id: "rId1",
    type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
    target: "word/document.xml",
  },
  {
    id: "rId2",
    type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
    target: "docProps/core.xml",
  },
]);

export const STYLES_XML =
  `${XML_DECLARATION}<w:styles xmlns:w="${W_NS}">` +
  "<w:docDefaults>" +
  '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Calibri" w:cs="Calibri"/>' +
  `<w:color w:val="${COLOR.body}"/><w:sz w:val="${SIZE.body}"/><w:szCs w:val="${SIZE.body}"/></w:rPr></w:rPrDefault>` +
  '<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  "</w:docDefaults>" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
  '<w:name w:val="Normal"/><w:qFormat/>' +
  `<w:rPr><w:sz w:val="${SIZE.body}"/><w:szCs w:val="${SIZE.body}"/></w:rPr>` +
  "</w:style>" +
  '<w:style w:type="paragraph" w:styleId="ListParagraph">' +
  '<w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:ind w:start="720"/><w:contextualSpacing/></w:pPr>' +
  "</w:style>" +
  "</w:styles>";

// U+F0B7 is the Symbol-font glyph Word has always used for a round bullet.
const BULLET_GLYPH = "";

export const NUMBERING_XML =
  `${XML_DECLARATION}<w:numbering xmlns:w="${W_NS}">` +
  `<w:abstractNum w:abstractNumId="${BULLET_NUM_ID}">` +
  '<w:lvl w:ilvl="0">' +
  '<w:start w:val="1"/>' +
  '<w:numFmt w:val="bullet"/>' +
  `<w:lvlText w:val="${BULLET_GLYPH}"/>` +
  '<w:lvlJc w:val="left"/>' +
  '<w:pPr><w:ind w:start="720" w:hanging="360"/></w:pPr>' +
  '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' +
  "</w:lvl>" +
  "</w:abstractNum>" +
  `<w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="${BULLET_NUM_ID}"/></w:num>` +
  "</w:numbering>";

/**
 * `docProps/core.xml` isn't quite a constant - it carries `profile.name` -
 * but everything else about it is fixed, including the timestamp: a
 * generated résumé is deterministic output, not a record of when it was
 * downloaded.
 */
export function coreXml(creatorName: string): string {
  const timestamp = "2026-01-01T00:00:00Z";
  return (
    `${XML_DECLARATION}<cp:coreProperties ` +
    'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xmlText("Résumé")}</dc:title>` +
    `<dc:creator>${xmlText(creatorName)}</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>` +
    "</cp:coreProperties>"
  );
}
