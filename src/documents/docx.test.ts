import { describe, expect, it } from "vitest";
import { buildDocx, paragraph, statementDocx, table, vpatDocx, xmlEscape } from "./docx";
import { formatReviewDate, generateStatement } from "./statement";
import { generateVpat } from "./vpat";

/** Entries are stored uncompressed, so the XML is readable straight out of the bytes. */
const read = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const REVIEWED_AT = Date.UTC(2026, 7, 7);

/**
 * Asserts the fragment is well-formed XML.
 *
 * This exists because the first version of `table` emitted border attributes as
 * child elements — `<w:top w:val="single" <w:sz w:val="4"/>/>` — and every
 * `toContain` assertion in this file passed on it. Word rejects such a file as
 * "unreadable content" without saying where, so the failure would have surfaced
 * on a customer's desk rather than here.
 *
 * Node has no XML parser and pulling one in for a test is not worth it, so this
 * checks the two structural properties that matter: no `<` may appear inside a
 * tag, and every element must be closed in order.
 */
function assertWellFormed(xml: string): void {
  const stack: string[] = [];

  for (let i = 0; i < xml.length; i++) {
    if (xml[i] !== "<") continue;

    const end = xml.indexOf(">", i);
    expect(end, `unterminated tag at ${i}`).toBeGreaterThan(-1);

    const tag = xml.slice(i + 1, end);
    expect(tag.includes("<"), `nested "<" inside a tag: ${tag.slice(0, 80)}`).toBe(false);

    i = end;

    if (tag.startsWith("?") || tag.startsWith("!")) continue; // declaration or comment

    if (tag.startsWith("/")) {
      expect(stack.pop(), "closing tag with no matching open").toBe(tag.slice(1).trim());
      continue;
    }
    if (tag.endsWith("/")) continue; // self-closing

    stack.push(tag.split(/[\s/]/)[0]!);
  }

  expect(stack, "unclosed elements").toEqual([]);
}

describe("xmlEscape", () => {
  it("escapes the five XML metacharacters", () => {
    expect(xmlEscape(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &apos; f",
    );
  });

  it("strips control characters that would make Word reject the file", () => {
    expect(xmlEscape("before\u0000\u0007\u001fafter")).toBe("beforeafter");
  });

  it("keeps tab, newline and carriage return, which are legal in XML", () => {
    expect(xmlEscape("a\tb\nc\rd")).toBe("a\tb\nc\rd");
  });
});

describe("paragraph", () => {
  it("omits the style block for body text", () => {
    expect(paragraph("Hello")).not.toContain("w:pStyle");
  });

  it("names the style when one is given", () => {
    expect(paragraph("Hello", "Heading1")).toContain('<w:pStyle w:val="Heading1"/>');
  });

  it("preserves surrounding whitespace", () => {
    expect(paragraph(" padded ")).toContain('xml:space="preserve"> padded <');
  });
});

describe("table", () => {
  const xml = table(["A", "B"], [["1", "2"], ["3", "4"]], [4819, 4819]);

  it("repeats the header row across pages", () => {
    expect(xml).toContain("<w:tblHeader/>");
  });

  it("emits one row per input row plus the header", () => {
    expect(xml.match(/<w:tr>/g)).toHaveLength(3);
  });

  it("is followed by a paragraph, which Word requires after a table", () => {
    expect(xml.endsWith("</w:tbl><w:p/>")).toBe(true);
  });

  it("writes cell borders as attributes rather than child elements", () => {
    assertWellFormed(xml);
    expect(xml).toContain('<w:top w:val="single" w:sz="4" w:space="0" w:color="C9C9C9"/>');
  });

  it("declares a table width matching the grid", () => {
    expect(xml).toContain('<w:tblW w:w="9638" w:type="dxa"/>');
  });
});

describe("buildDocx", () => {
  const bytes = buildDocx(paragraph("Hello"));
  const text = read(bytes);

  it("is a zip", () => {
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
  });

  it("carries the four parts Word needs plus the styles it renders from", () => {
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/styles.xml",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("closes the body with a section definition", () => {
    expect(text).toContain("<w:sectPr>");
    expect(text).toContain("</w:body></w:document>");
  });

  it("emits well-formed XML in every part", () => {
    for (const part of [CONTENT_TYPES_RE, DOCUMENT_RE, STYLES_RE]) {
      const match = part.exec(text);
      expect(match, `part not found: ${part}`).not.toBeNull();
      assertWellFormed(match![0]);
    }
  });
});

// The parts sit end to end inside the archive, so each is matched from its own
// root element rather than sliced by offset.
const CONTENT_TYPES_RE = /<Types[\s\S]*?<\/Types>/;
const DOCUMENT_RE = /<w:document[\s\S]*?<\/w:document>/;
const STYLES_RE = /<w:styles[\s\S]*?<\/w:styles>/;

describe("statementDocx", () => {
  const statement = generateStatement({
    organisation: "Cascade Ops Inc.",
    domain: "cascadeops.com",
    contactEmail: "access@cascadeops.com",
    reviewedAt: REVIEWED_AT,
  });
  const text = read(statementDocx(statement));

  it("emits a well-formed document", () => {
    assertWellFormed(DOCUMENT_RE.exec(text)![0]);
  });

  it("carries the title and the review date", () => {
    expect(text).toContain("Accessibility statement for Cascade Ops Inc.");
    expect(text).toContain(`Last reviewed ${formatReviewDate(REVIEWED_AT)}`);
  });

  it("carries every section heading", () => {
    for (const heading of ["Conformance status", "Known limitations", "Feedback", "Assessment approach"]) {
      expect(text).toContain(heading);
    }
  });

  it("keeps the coverage limit in the document", () => {
    // Guardrail 5: the export carries the caveat, not just the screen.
    expect(text).toContain("Automated testing covers only part of the WCAG success criteria");
  });

  it("leaves the generator's warnings out of the published artefact", () => {
    // The warnings are advice to whoever is writing the statement. This file is
    // what gets published on the customer's own site, so they do not belong in
    // it — but they must exist, or this test is passing for the wrong reason.
    expect(statement.warnings.length).toBeGreaterThan(0);
    expect(text).not.toContain(statement.warnings[0]!);
  });
});

describe("vpatDocx", () => {
  const vpat = generateVpat({
    productName: "cascadeops.com",
    evaluatedAt: REVIEWED_AT,
    edition: "508",
    evaluatedOn: formatReviewDate(REVIEWED_AT),
  });
  const text = read(vpatDocx(vpat));

  it("emits a well-formed document even at 55 rows", () => {
    assertWellFormed(DOCUMENT_RE.exec(text)![0]);
  });

  it("emits a row for every criterion, including the ones no scanner reaches", () => {
    // Header row plus one per criterion. Dropping the unreachable ones would
    // read to a procurement officer as a table where everything passed.
    expect(text.match(/<w:tr>/g)).toHaveLength(vpat.rows.length + 1);
    expect(text).toContain("Not evaluated");
  });

  it("carries the edition's scope note", () => {
    expect(text).toContain("Revised");
  });

  it("ends with the disclaimer", () => {
    expect(text).toContain("Status of this draft");
    expect(text).toContain("Every row needs a human to confirm");
  });

  it("escapes remarks rather than injecting them as markup", () => {
    const hostile = generateVpat(
      {
        productName: "<script>alert(1)</script>",
        evaluatedAt: REVIEWED_AT,
        evaluatedOn: "7 August 2026",
      },
    );
    const out = read(vpatDocx(hostile));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
