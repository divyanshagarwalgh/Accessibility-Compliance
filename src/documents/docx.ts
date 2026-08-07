/**
 * `.docx` export for the statement and the VPAT.
 *
 * ## Why a real .docx and not an HTML file with a .doc extension
 *
 * The common shortcut is to serve HTML as `application/msword`. Word opens it,
 * so it looks like it works — until the file reaches a procurement team, who
 * open it in Google Docs or LibreOffice and get either markup on screen or a
 * warning dialog. A VPAT arriving with a warning dialog is worse than no VPAT.
 * So this writes genuine OOXML: a zip of XML parts, which every word processor
 * and every document management system reads without complaint.
 *
 * ## The parts
 *
 * Four are required and all four are here: the content-type map, the package
 * relationships, the document body, and the styles the body references. Word
 * silently renders every paragraph as body text if `styles.xml` is missing, so
 * a document without it has no headings — which on a 55-row VPAT is the
 * difference between a document and a wall.
 *
 * ## Lists
 *
 * Bulleted lists are rendered as indented paragraphs with a literal bullet
 * character rather than through `numbering.xml`. Real numbering needs a fifth
 * part, an abstract numbering definition and a per-list instance, and the only
 * lists in these documents are the flat single-level ones in a statement's
 * known-limitations section. The visual result is identical.
 */

import type { Statement } from "./statement";
import type { Vpat } from "./vpat";
import { zip } from "@/lib/zip";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Escapes text for an XML text node.
 *
 * The control-character strip is not decoration: characters below 0x20 other
 * than tab, newline and carriage return are illegal in XML 1.0, and Word
 * responds to one by refusing the whole file as "unreadable content". Scan
 * remarks are built from page content, so this is reachable input.
 */
export function xmlEscape(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type ParagraphStyle = "Title" | "Heading1" | "Heading2" | "Caption" | "Bullet" | "Normal";

/** One paragraph. `xml:space="preserve"` keeps leading and trailing spaces. */
export function paragraph(text: string, style: ParagraphStyle = "Normal"): string {
  const pPr = style === "Normal" ? "" : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

/** An empty spacer paragraph. Also what a table must be followed by. */
export function blank(): string {
  return "<w:p/>";
}

export function bullets(items: string[]): string {
  return items.map((item) => paragraph(`• ${item}`, "Bullet")).join("");
}

function cell(text: string, width: number, bold: boolean): string {
  const rPr = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>` +
    `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p></w:tc>`
  );
}

/**
 * A bordered table with a repeating header row.
 *
 * `tblHeader` makes the header repeat on every page, which matters on a VPAT:
 * 55 rows runs to three pages, and a conformance column with no heading on
 * pages two and three is unreadable.
 *
 * Widths are in twips and must sum to the printable width — 9638 on A4 with the
 * margins set below.
 */
export function table(
  headers: string[],
  rows: string[][],
  widths: number[],
): string {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");

  const headerRow =
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
    headers.map((h, i) => cell(h, widths[i] ?? 1000, true)).join("") +
    `</w:tr>`;

  const bodyRows = rows
    .map(
      (row) =>
        `<w:tr>${row.map((value, i) => cell(value, widths[i] ?? 1000, false)).join("")}</w:tr>`,
    )
    .join("");

  // `w:sz`, `w:space` and `w:color` are attributes of the border element, not
  // child elements of it. Writing them as children produces `<w:top ... <w:sz
  // .../>/>`, which is not XML at all — Word reports "unreadable content" and
  // says nothing about where.
  const border = 'w:val="single" w:sz="4" w:space="0" w:color="C9C9C9"';
  const borders =
    `<w:tblBorders>` +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((side) => `<w:${side} ${border}/>`)
      .join("") +
    `</w:tblBorders>`;

  const total = widths.reduce((sum, w) => sum + w, 0);

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${borders}` +
    `<w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>${blank()}`
  );
}

/** A4 portrait with 2 cm margins. Printable width: 9638 twips. */
const SECTION =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" ' +
  'w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>';

const STYLES = `${XML_DECL}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
    <w:sz w:val="22"/><w:szCs w:val="22"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Caption">
    <w:name w:val="caption"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="240"/></w:pPr>
    <w:rPr><w:color w:val="6B6B6B"/><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Bullet">
    <w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="454" w:hanging="227"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
</w:styles>`;

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const PACKAGE_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/** Wraps prebuilt block XML into a complete `.docx` package. */
export function buildDocx(blocks: string): Uint8Array<ArrayBuffer> {
  const document =
    `${XML_DECL}\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${blocks}${SECTION}</w:body></w:document>`;

  return zip([
    // Convention across every producer: the content-type map comes first.
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: PACKAGE_RELS },
    { name: "word/_rels/document.xml.rels", content: DOCUMENT_RELS },
    { name: "word/document.xml", content: document },
    { name: "word/styles.xml", content: STYLES },
  ]);
}

/**
 * The accessibility statement as a `.docx`.
 *
 * The generator's `warnings` are deliberately left out. They are advice to the
 * person writing the statement — "the status was downgraded because the scan
 * still reports failures" — and this file is the artefact that gets published on
 * the customer's own site. The coverage limit still appears in the document,
 * because the generator writes it into the Assessment approach section, which is
 * where a reader would look for it.
 */
export function statementDocx(statement: Statement): Uint8Array<ArrayBuffer> {
  const blocks = [
    paragraph(statement.title, "Title"),
    paragraph(`Last reviewed ${statement.reviewedOn}`, "Caption"),
    ...statement.sections.flatMap((section) => [
      section.heading ? paragraph(section.heading, "Heading1") : "",
      ...section.paragraphs.map((p) => paragraph(p)),
      section.list && section.list.length > 0 ? bullets(section.list) : "",
    ]),
  ].join("");

  return buildDocx(blocks);
}

/**
 * The VPAT as a `.docx`.
 *
 * The disclaimer is the last thing in the document and is not optional —
 * guardrail 5 applies most sharply here, because this file is read by someone
 * making a purchasing decision and read without us in the room.
 */
export function vpatDocx(vpat: Vpat): Uint8Array<ArrayBuffer> {
  const rows = vpat.rows.map((row) => [
    row.sc,
    row.name,
    row.level,
    row.conformance,
    row.remarks,
  ]);

  const blocks = [
    paragraph(vpat.title, "Title"),
    paragraph(`${vpat.productName} · evaluated ${vpat.evaluatedOn}`, "Caption"),
    paragraph(vpat.scopeNote),
    paragraph("WCAG 2.2 Level A and AA", "Heading1"),
    // Criterion, name, level, conformance, remarks — summing to the 9638 twip
    // printable width.
    table(
      ["Criterion", "Name", "Level", "Conformance level", "Remarks and explanations"],
      rows,
      [900, 2400, 600, 1800, 3938],
    ),
    paragraph(vpat.footerNote),
    paragraph("Status of this draft", "Heading1"),
    paragraph(vpat.disclaimer),
  ].join("");

  return buildDocx(blocks);
}
