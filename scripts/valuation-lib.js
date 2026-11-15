// v4 valuation report — Arabic RTL docx (R1 cover / DS-1 palette, 3 sections, TOC)
// Per docx skill: report scene (pure black body), horizontal-only tables (DS-1 tokens),
// calcTitleLayout + calcCoverSpacing adapted for Arabic char width.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, TableLayoutType,
  AlignmentType, HeadingLevel, BorderStyle, ShadingType, WidthType, SectionType,
  PageNumber, NumberFormat, Header, Footer, TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");

// ── palette DS-1 (Deep Sea) + table tokens ──
const P = {
  bg: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const AR = { ascii: "Arial", hAnsi: "Arial", cs: "Arial" };

// Arabic-aware title layout (char width ≈ pt×12 twips; breaks at spaces, ≤3 lines, no orphans)
function splitTitleLinesAr(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const words = title.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length <= charsPerLine) cur = cand;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop(); lines[lines.length - 1] += " " + last;
  }
  return lines;
}
function calcTitleLayoutAr(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 12;
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = Math.floor(maxWidthTwips / charWidth(titlePt));
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLinesAr(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLinesAr(title, Math.floor(maxWidthTwips / charWidth(minPt)));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(p) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = p;
  const SAFETY = 1200;
  const usable = pageHeight - marginTop - marginBottom - SAFETY;
  const titleH = titleLineCount * (titlePt * 23 + 200);
  const subH = hasSubtitle ? (12 * 23 + 600) : 0;
  const engH = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaH = metaLineCount * (10 * 23 + 100);
  const implicit = 3 * 300;
  const content = titleH + subH + engH + metaH + fixedHeight + implicit;
  const remaining = Math.max(usable - content, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remaining * 0.45), rawBottom = Math.floor(remaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(remaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── R1 cover, RTL-adapted (text starts right; accent bar on the right of meta lines) ──
function buildCoverR1RTL(config) {
  const padR = 1200, padL = 800;
  const availableWidth = 11906 - padR - padL - 300;
  const { titlePt, titleLines } = calcTitleLayoutAr(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentRight = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT, indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: AR, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true, indent: { right: padR },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, sizeComplexScript: titleSize, bold: true, boldComplexScript: true, rightToLeft: true, color: P.cover.titleColor, font: AR })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      bidirectional: true, indent: { right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, sizeComplexScript: 24, rightToLeft: true, color: P.cover.subtitleColor, font: AR })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true, indent: { right: padR + 200 }, spacing: { after: 80 },
      border: { right: accentRight },
      children: [new TextRun({ text: line, size: 24, sizeComplexScript: 24, rightToLeft: true, color: P.cover.metaColor, font: AR })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerRight || "", size: 16, sizeComplexScript: 16, rightToLeft: true, color: P.cover.footerColor, font: AR }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerLeft || "", size: 16, sizeComplexScript: 16, rightToLeft: true, color: P.cover.footerColor, font: AR }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })],
    })],
  })];
}

// ── body helpers (report profile: pure black body, line 312, RTL) ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 160, line: 340, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, boldComplexScript: true, rightToLeft: true, size: 32, sizeComplexScript: 32, color: "000000", font: AR })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, bidirectional: true,
    spacing: { before: 240, after: 120, line: 320, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, boldComplexScript: true, rightToLeft: true, size: 28, sizeComplexScript: 28, color: "000000", font: AR })],
  });
}
function body(runsOrText) {
  const runs = typeof runsOrText === "string"
    ? [new TextRun({ text: runsOrText, size: 24, sizeComplexScript: 24, rightToLeft: true, color: "000000", font: AR })]
    : runsOrText;
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 },
    children: runs,
  });
}
function b(text) { return new TextRun({ text, bold: true, boldComplexScript: true, size: 24, sizeComplexScript: 24, rightToLeft: true, color: "000000", font: AR }); }
function r(text) { return new TextRun({ text, size: 24, sizeComplexScript: 24, rightToLeft: true, color: "000000", font: AR }); }

// horizontal-only RTL table
function rtlTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 312 },
        children: [new TextRun({ text: t, bold: true, boldComplexScript: true, rightToLeft: true, size: 21, sizeComplexScript: 21, color: P.table.headerText, font: AR })] })],
    })),
  });
  const dataRows = rows.map((cells, ri) => new TableRow({
    cantSplit: true,
    children: cells.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? P.table.surface : "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 312 },
        children: [new TextRun({ text: t, size: 21, sizeComplexScript: 21, rightToLeft: true, color: "000000", font: AR })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
}
function tableCaption(text) {
  return new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, boldComplexScript: true, rightToLeft: true, size: 21, sizeComplexScript: 21, color: "404040", font: AR })],
  });
}
function pageFooter() {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: AR })] })] });
}
function pageHeader() {
  return new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "C0C8CC", space: 4 } },
    children: [new TextRun({ text: "تقييم تكلفة التطوير وقيمة البيع — تطبيق سلكني ونسلكك", size: 18, sizeComplexScript: 18, rightToLeft: true, color: "808080", font: AR })] })] });
}

module.exports = { buildCoverR1RTL, h1, h2, body, b, r, rtlTable, tableCaption, pageFooter, pageHeader, AR, P, allNoBorders, noBorders, NB };
