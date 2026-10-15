import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFName,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { FieldMapping, FormTemplate, GenerationContext } from "./types";
import { fullName } from "./engine";
import { templateBytes, assetUrl, toDataUrl } from "./templates";

export function bindingValue(
  field: FieldMapping,
  ctx: GenerationContext,
): string | boolean {
  if (field.binding === "manual")
    return ctx.custom[field.id] ?? (field.kind === "checkbox" ? false : "");
  if (field.binding === "patient.fullName") return fullName(ctx.patient);
  if (field.binding.startsWith("patient."))
    return String(
      ctx.patient[field.binding.slice(8) as keyof typeof ctx.patient] ?? "",
    );
  if (field.binding === "priority.stat") return ctx.patient.priority === "STAT";
  if (field.binding === "priority.routine")
    return ctx.patient.priority === "Routine";
  if (field.binding.startsWith("test:")) {
    const key = field.binding
      .slice(5)
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
    return ctx.request.orders.some(
      (o) =>
        o.test.name
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase()
          .includes(key) ||
        (key === "fnabinpatientdoneby" && o.test.name.startsWith("FNAB")) ||
        (key === "reticreticularfibers" &&
          o.test.name === "Reticular Fibers Stain") ||
        (key === "giemsaforhpylori" && o.test.name === "Giemsa for H. pylori"),
    );
  }
  if (field.binding === "request.tests")
    return ctx.request.orders
      .map((o) => o.test.name + (o.order.notes ? ` (${o.order.notes})` : ""))
      .join(", ");
  return String(
    ctx.request[
      field.binding.replace("request.", "") as keyof typeof ctx.request
    ] ?? "",
  );
}
export function wrapText(
  text: string,
  width: number,
  font: PDFFont,
  size: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= width) {
        line = word;
        continue;
      }
      let part = "";
      for (const ch of word) {
        if (part && font.widthOfTextAtSize(part + ch, size) > width) {
          lines.push(part);
          part = ch;
        } else part += ch;
      }
      line = part;
    }
    lines.push(line);
  }
  return lines;
}
const supportedCharacters = new WeakMap<PDFFont, Set<number>>();
export function overflowReason(
  field: FieldMapping,
  value: string | boolean,
  font: PDFFont,
): string | undefined {
  if (field.kind === "checkbox" || !value) return;
  const text = String(value),
    width = field.width - 4,
    height = field.height - 3;
  let characters = supportedCharacters.get(font);
  if (!characters) {
    characters = new Set(font.getCharacterSet());
    supportedCharacters.set(font, characters);
  }
  const missing = [...text].find(
    (char) => !/\s/.test(char) && !characters.has(char.codePointAt(0)!),
  );
  if (missing)
    return `The character “${missing}” is not supported by the PDF font. Replace it with plain text before exporting.`;
  if (field.kind !== "multiline") {
    if (
      text.includes("\n") ||
      font.widthOfTextAtSize(text, field.fontSize) > width ||
      height < field.fontSize * 0.9
    )
      return "Text is too long for this field. Shorten it or enlarge the mapped field.";
  } else if (
    wrapText(text, width, font, field.fontSize).length * field.fontSize * 1.18 >
    height
  )
    return "Text exceeds the field height. Enlarge the field or use an additional page.";
}
let fontBytesPromise: Promise<ArrayBuffer> | undefined;
async function embedFont(
  doc: PDFDocument,
  fontBytes?: ArrayBuffer | Uint8Array,
) {
  doc.registerFontkit(fontkit);
  if (!fontBytes) {
    fontBytesPromise ??= fetch(
      assetUrl("fonts/LiberationSans-Regular.ttf"),
    ).then((r) => {
      if (!r.ok) throw new Error("Could not load the bundled PDF font.");
      return r.arrayBuffer();
    });
    fontBytes = await fontBytesPromise;
  }
  return doc.embedFont(fontBytes, { subset: true });
}
export interface PdfItem {
  template: FormTemplate;
  context: GenerationContext;
}
export interface PdfResult {
  bytes: Uint8Array;
  pages: number;
  fields: number;
}
export async function generatePdf(
  items: PdfItem[],
  editable: boolean,
  options: {
    fontBytes?: ArrayBuffer | Uint8Array;
    loadTemplate?: (t: FormTemplate) => Promise<Uint8Array>;
  } = {},
): Promise<PdfResult> {
  if (!items.length) throw new Error("Select at least one mapped request.");
  const doc = await PDFDocument.create(),
    form = doc.getForm(),
    font = await embedFont(doc, options.fontBytes);
  const load = options.loadTemplate ?? templateBytes;
  let fourPage: PDFPage | undefined,
    fourSlot = 0,
    count = 0;
  const backgrounds = new Map<string, Awaited<ReturnType<typeof prepare>>>();
  async function prepare(template: FormTemplate) {
    const data = await load(template);
    if (template.fileType !== "pdf")
      return {
        image:
          template.fileType === "png"
            ? await doc.embedPng(data)
            : await doc.embedJpg(data),
        pdf: undefined,
      };
    const blank = await PDFDocument.load(data);
    // Backgrounds contain page artwork only. Removing the annotation arrays also
    // handles legacy widgets whose appearance dictionaries are malformed.
    for (const page of blank.getPages()) page.node.delete(PDFName.of("Annots"));
    blank.catalog.delete(PDFName.of("AcroForm"));
    const pdf = await doc.embedPdf(await blank.save(), blank.getPageIndices());
    return { image: undefined, pdf };
  }
  for (let i = 0; i < items.length; i++) {
    const { template, context } = items[i];
    for (const field of template.fields) {
      const reason = overflowReason(field, bindingValue(field, context), font);
      if (reason)
        throw new Error(`${template.name} · ${field.name}: ${reason}`);
    }
    let bg = backgrounds.get(template.id);
    if (!bg) {
      bg = await prepare(template);
      backgrounds.set(template.id, bg);
    }
    for (
      let pageIndex = 0;
      pageIndex < template.pageSizes.length;
      pageIndex++
    ) {
      const size = template.pageSizes[pageIndex];
      let page: PDFPage,
        x = 0,
        top = 0,
        scale = 1;
      if (template.fourUp) {
        if (!fourPage || fourSlot === 4) {
          fourPage = doc.addPage([595.28, 841.89]);
          fourSlot = 0;
        }
        page = fourPage;
        const width = (595.28 - 36 - 16) / 2;
        scale = width / size.width;
        x = 18 + (fourSlot % 2) * (width + 16);
        top = 18 + Math.floor(fourSlot / 2) * (size.height * scale + 16);
        fourSlot++;
      } else {
        fourPage = undefined;
        fourSlot = 0;
        page = doc.addPage([size.width, size.height]);
      }
      const y = page.getHeight() - top - size.height * scale;
      if (bg.image)
        page.drawImage(bg.image, {
          x,
          y,
          width: size.width * scale,
          height: size.height * scale,
        });
      else if (bg.pdf?.[pageIndex])
        page.drawPage(bg.pdf[pageIndex], {
          x,
          y,
          width: size.width * scale,
          height: size.height * scale,
        });
      for (const field of template.fields.filter((f) => f.page === pageIndex)) {
        const value = bindingValue(field, context);
        const rect = {
          x: x + field.x * scale,
          y: page.getHeight() - top - (field.y + field.height) * scale,
          width: field.width * scale,
          height: field.height * scale,
          borderWidth: 0,
          backgroundColor: undefined,
          borderColor: undefined,
        };
        const name = `request${i + 1}.${field.id.replace(/[^a-z0-9_-]/gi, "_")}`;
        if (field.kind === "checkbox") {
          const check = form.createCheckBox(name);
          check.addToPage(page, { ...rect, textColor: rgb(0.08, 0.13, 0.12) });
          if (value === true || value === "true") check.check();
        } else {
          const text = form.createTextField(name);
          if (field.kind === "multiline") text.enableMultiline();
          text.addToPage(page, {
            ...rect,
            font,
            textColor: rgb(0.06, 0.1, 0.09),
          });
          text.setFontSize(field.fontSize * scale);
          text.setText(
            field.kind === "multiline"
              ? wrapText(
                  String(value),
                  field.width - 4,
                  font,
                  field.fontSize,
                ).join("\n")
              : String(value),
          );
          text.disableScrolling();
        }
        count++;
      }
    }
  }
  form.updateFieldAppearances(font);
  if (!editable) {
    form.flatten();
    for (const page of doc.getPages()) page.node.delete(PDFName.of("Annots"));
    doc.catalog.delete(PDFName.of("AcroForm"));
  }
  doc.setTitle("PGH Forms · Laboratory requests");
  doc.setProducer("PGH Forms — local browser generation");
  doc.setAuthor("");
  doc.setSubject("");
  return { bytes: await doc.save(), pages: doc.getPageCount(), fields: count };
}

export async function importBackground(
  file: File,
): Promise<{ template: FormTemplate; discardedValues: boolean }> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a background smaller than 20 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const raw = new Uint8Array(await file.arrayBuffer());
  const template: FormTemplate = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    fileType: ext === "pdf" ? "pdf" : ext === "png" ? "png" : "jpg",
    fields: [],
    pageSizes: [],
  };
  let discardedValues = false;
  if (ext === "pdf") {
    const doc = await PDFDocument.load(raw);
    const form = doc.getForm();
    const pages = doc.getPages();
    template.pageSizes = pages.map((p) => p.getSize());
    for (const field of form.getFields()) {
      if (!(
        field instanceof PDFTextField ||
        field instanceof PDFCheckBox ||
        field instanceof PDFDropdown ||
        field instanceof PDFRadioGroup
      )) {
        if (
          field.acroField.dict.get(PDFName.of("FT")) === PDFName.of("Sig") &&
          !field.acroField.dict.get(PDFName.of("V"))
        )
          continue;
        throw new Error(
          "This PDF contains a signed or unsupported field. Upload an unsigned blank form instead.",
        );
      }
      const value =
        field instanceof PDFTextField
          ? field.getText()
          : field instanceof PDFCheckBox
            ? field.isChecked()
            : field.getSelected();
      if (value && (Array.isArray(value) ? value.length > 0 : true))
        discardedValues = true;
      for (const widget of field.acroField.getWidgets()) {
        const pageIndex = pages.findIndex((p) =>
          p.node
            .Annots()
            ?.asArray()
            .some((ref) => doc.context.lookup(ref) === widget.dict),
        );
        if (pageIndex < 0) continue;
        const r = widget.getRectangle();
        const name = field.getName();
        template.fields.push({
          id: crypto.randomUUID(),
          nativeName: name,
          name,
          page: pageIndex,
          x: r.x,
          y: pages[pageIndex].getHeight() - r.y - r.height,
          width: r.width,
          height: r.height,
          fontSize: Math.max(4, Math.min(9, Math.floor((r.height - 3) / 0.95))),
          kind:
            field instanceof PDFCheckBox
              ? "checkbox"
              : field instanceof PDFTextField && field.isMultiline()
                ? "multiline"
                : "text",
          binding: "manual",
        });
      }
    }
    // Remove values, actions, annotations and attachments from reusable backgrounds.
    // Imported widgets are recreated from the mapping with empty/manual defaults.
    for (const page of pages) {
      page.node.delete(PDFName.of("Annots"));
      page.node.delete(PDFName.of("AA"));
    }
    doc.catalog.delete(PDFName.of("OpenAction"));
    doc.catalog.delete(PDFName.of("AA"));
    doc.catalog.delete(PDFName.of("Names"));
    const clean = await PDFDocument.create();
    for (const page of await clean.copyPages(doc, doc.getPageIndices()))
      clean.addPage(page);
    template.data = toDataUrl(await clean.save(), "application/pdf");
  } else if (["png", "jpg", "jpeg"].includes(ext ?? "")) {
    const doc = await PDFDocument.create();
    const image =
      ext === "png" ? await doc.embedPng(raw) : await doc.embedJpg(raw);
    const width = 595.28,
      height = (image.height / image.width) * width;
    template.pageSizes = [{ width, height }];
    template.data = toDataUrl(raw, ext === "png" ? "image/png" : "image/jpeg");
  } else throw new Error("Upload a PDF, PNG, or JPEG blank form.");
  return { template, discardedValues };
}
