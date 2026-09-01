import { describe, expect, it } from "vitest";
import {
  coreXml,
  documentXml,
  hyperlink,
  NUMBERING_XML,
  paragraph,
  PAGE,
  run,
  STYLES_XML,
  tab,
  xmlAttr,
  xmlText,
} from "./ooxml";

describe("xmlText", () => {
  it("escapes &, <, and >", () => {
    expect(xmlText("A & B < C > D")).toBe("A &amp; B &lt; C &gt; D");
  });

  it("survives real résumé content containing '&'", () => {
    expect(xmlText("Workato Foundations Levels 1 & 2")).toBe(
      "Workato Foundations Levels 1 &amp; 2",
    );
  });
});

describe("xmlAttr", () => {
  it('escapes &, <, >, and "', () => {
    expect(xmlAttr(`A & B < C > D "E"`)).toBe("A &amp; B &lt; C &gt; D &quot;E&quot;");
  });

  it("escapes '", () => {
    expect(xmlAttr("O'Brien")).toBe("O&apos;Brien");
  });
});

describe("run", () => {
  it("emits no more than the shared font block when given no style", () => {
    const xml = run("Plain text");
    expect(xml).toBe(
      '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Calibri" w:cs="Calibri"/></w:rPr><w:t>Plain text</w:t></w:r>',
    );
  });

  it('adds xml:space="preserve" only when the text has leading or trailing whitespace', () => {
    expect(run("no edge whitespace")).not.toContain("xml:space");
    expect(run("  |  ")).toContain('xml:space="preserve"');
    expect(run("trailing ")).toContain('xml:space="preserve"');
    expect(run(" leading")).toContain('xml:space="preserve"');
  });

  it("emits bold, italic, caps, color, size/szCs, spacing, and underline", () => {
    const xml = run("Styled", {
      bold: true,
      italic: true,
      caps: true,
      underline: true,
      color: "1F3864",
      size: 40,
      spacing: 46,
    });
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:caps/>");
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('<w:color w:val="1F3864"/>');
    expect(xml).toContain('<w:sz w:val="40"/>');
    expect(xml).toContain('<w:szCs w:val="40"/>');
    expect(xml).toContain('<w:spacing w:val="46"/>');
  });
});

describe("tab", () => {
  it("is a bare run containing a tab", () => {
    expect(tab()).toBe("<w:r><w:tab/></w:r>");
  });
});

describe("hyperlink", () => {
  it("wraps runs in a hyperlink referencing the relationship id", () => {
    const runs = run("example.com", { color: "1F3864", underline: true });
    expect(hyperlink("rId3", runs)).toBe(`<w:hyperlink r:id="rId3">${runs}</w:hyperlink>`);
  });
});

describe("paragraph", () => {
  it("emits align, keepNext, bottomBorder, spacing, rightTabAt, numId, and style", () => {
    const xml = paragraph(
      {
        align: "center",
        keepNext: true,
        bottomBorder: { size: 4, space: 6, color: "BFC7D4" },
        spacing: { before: 60, after: 26, line: 235 },
        rightTabAt: 10800,
        numId: 1,
        style: "ListParagraph",
      },
      [run("hello")],
    );
    expect(xml).toContain('<w:pStyle w:val="ListParagraph"/>');
    expect(xml).toContain("<w:keepNext/>");
    expect(xml).toContain('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
    expect(xml).toContain(
      '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="6" w:color="BFC7D4"/></w:pBdr>',
    );
    expect(xml).toContain('<w:tabs><w:tab w:val="right" w:pos="10800"/></w:tabs>');
    expect(xml).toContain('<w:spacing w:before="60" w:after="26" w:line="235" w:lineRule="auto"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
  });

  it("omits <w:pPr> entirely when given no options", () => {
    const xml = paragraph({}, [run("plain")]);
    expect(xml).not.toContain("<w:pPr>");
    expect(xml).toBe(`<w:p>${run("plain")}</w:p>`);
  });

  it("joins multiple runs in order", () => {
    const xml = paragraph({}, [run("first"), tab(), run("second")]);
    expect(xml).toBe(`<w:p>${run("first")}${tab()}${run("second")}</w:p>`);
  });
});

describe("documentXml", () => {
  it("declares xmlns:r and wraps the body in a fixed sectPr", () => {
    const xml = documentXml(paragraph({}, [run("Body")]));
    expect(xml).toContain(
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    );
    expect(xml).toContain(`<w:pgSz w:w="${PAGE.w}" w:h="${PAGE.h}"/>`);
    expect(xml).toContain(
      `<w:pgMar w:top="${PAGE.top}" w:right="${PAGE.right}" w:bottom="${PAGE.bottom}" w:left="${PAGE.left}"/>`,
    );

    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });
});

describe("coreXml", () => {
  it("carries the title and creator, and parses as XML", () => {
    const xml = coreXml("Jane Doe");
    expect(xml).toContain("<dc:title>Résumé</dc:title>");
    expect(xml).toContain("<dc:creator>Jane Doe</dc:creator>");

    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });
});

describe("static parts parse as well-formed XML", () => {
  it.each([
    ["STYLES_XML", STYLES_XML],
    ["NUMBERING_XML", NUMBERING_XML],
  ])("%s", (_name, xml) => {
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });
});
