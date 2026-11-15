#!/usr/bin/env python3
"""Post-process the valuation docx per toc.md:
1) strip empty <w:pgNumType/> (cover section)
2) patch footer instrText with explicit format switches (WPS compat):
   footer referenced by the upperRoman section -> PAGE \\* ROMAN, decimal -> PAGE \\* arabic
"""
import re, sys, zipfile, shutil, os

DOC = "/home/z/my-project/download/تقرير-تقييم-سلكني-ونسلكك.docx"
TMP = "/tmp/docx-post"

shutil.rmtree(TMP, ignore_errors=True)
os.makedirs(TMP)
with zipfile.ZipFile(DOC) as z:
    z.extractall(TMP)

doc_path = os.path.join(TMP, "word", "document.xml")
doc = open(doc_path, encoding="utf-8").read()

# 1) strip empty pgNumType
doc, n_empty = re.subn(r"<w:pgNumType/>", "", doc)

# 2) map each sectPr's number format -> its footerReference rId
sect_fmts = []  # list of (fmt, rIds)
for sect in re.findall(r"<w:sectPr[ >].*?</w:sectPr>", doc, flags=re.S):
    m = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', sect)
    fmt = m.group(1) if m else None
    rids = re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', sect)
    sect_fmts.append((fmt, rids))
print("sections:", sect_fmts, "| stripped empty pgNumType:", n_empty)

rels = open(os.path.join(TMP, "word", "_rels", "document.xml.rels"), encoding="utf-8").read()
rid_to_file = dict(re.findall(r'Id="([^"]+)"[^>]*Target="(footer\d+\.xml)"', rels))

patched = set()
for fmt, rids in sect_fmts:
    if not fmt:
        continue
    switch = "ROMAN" if "oman" in fmt or "ROMAN" in fmt.upper() else ("arabic" if fmt == "decimal" else None)
    if not switch:
        continue
    for rid in rids:
        f = rid_to_file.get(rid)
        if not f:
            continue
        p = os.path.join(TMP, "word", f)
        if f in patched or not os.path.exists(p):
            continue
        xml = open(p, encoding="utf-8").read()
        xml, n = re.subn(r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
                         rf"\1 PAGE \\* {switch} \\* MERGEFORMAT \2", xml)
        open(p, "w", encoding="utf-8").write(xml)
        patched.add(f)
        print(f"patched {f}: {n} field(s) -> {switch}")

open(doc_path, "w", encoding="utf-8").write(doc)

# 3) TOC field: the placeholder script leaves entry 1 embedded in the field with
#    an EMPTY PAGEREF result (merged single-run fldChars) AND a duplicate plain
#    text paragraph after it. Fix: split the merged run properly, inject cached
#    page number 1 as the PAGEREF result, un-dirty it, drop the duplicate row.
doc = open(doc_path, encoding="utf-8").read()
merged = re.search(
    r'<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/>'
    r'<w:instrText xml:space="preserve">PAGEREF _Toc1 \\h</w:instrText>'
    r'<w:fldChar w:fldCharType="separate"/>'
    r'<w:fldChar w:fldCharType="end"/></w:r>', doc)
assert merged, "merged PAGEREF run for _Toc1 not found"
fixed = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
         '<w:r><w:instrText xml:space="preserve"> PAGEREF _Toc1 \\h </w:instrText></w:r>'
         '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
         '<w:r><w:rPr><w:noProof/></w:rPr><w:t xml:space="preserve">1</w:t></w:r>'
         '<w:r><w:fldChar w:fldCharType="end"/></w:r>')
doc = doc[:merged.start()] + fixed + doc[merged.end():]
# drop the duplicate plain paragraph for entry 1 (first <w:p> after the field hyperlink row)
hl_end = doc.find("</w:hyperlink></w:p>") + len("</w:hyperlink></w:p>")
p_start = doc.find("<w:p>", hl_end)
p_end = doc.find("</w:p>", p_start) + len("</w:p>")
dup = doc[p_start:p_end]
assert "1. الملخص التنفيذي" in dup and "<w:hyperlink" not in dup, f"unexpected dup paragraph: {dup[:160]}"
doc = doc[:p_start] + doc[p_end:]
print("TOC entry 1: PAGEREF split + cached result + duplicate row removed")
open(doc_path, "w", encoding="utf-8").write(doc)

# rezip
out_tmp = DOC + ".new"
with zipfile.ZipFile(out_tmp, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(TMP):
        for fn in files:
            full = os.path.join(root, fn)
            z.write(full, os.path.relpath(full, TMP))
shutil.move(out_tmp, DOC)
print("REPACKED OK")
