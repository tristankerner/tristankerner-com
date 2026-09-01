import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

const encoder = new TextEncoder();

describe("crc32", () => {
  it("matches the standard check value for the ASCII digits '123456789'", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });

  it("returns 0 for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("zip", () => {
  it("places the local file header, central directory, and EOCD signatures at the expected offsets", () => {
    const archive = zip([
      { path: "[Content_Types].xml", data: encoder.encode("<a/>") },
      { path: "word/document.xml", data: encoder.encode("<b/>") },
    ]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    // First local file header starts the archive.
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    // Second local file header follows immediately after the first entry's
    // header + name + data.
    const firstEntrySize = 30 + "[Content_Types].xml".length + "<a/>".length;
    expect(view.getUint32(firstEntrySize, true)).toBe(0x04034b50);

    // EOCD entry count matches, and the central directory offset it records
    // points at a central directory header signature.
    const eocdOffset = archive.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 8, true)).toBe(2);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);

    const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
    expect(view.getUint32(centralDirectoryOffset, true)).toBe(0x02014b50);
  });

  it("produces byte-identical output across calls with the same input", () => {
    const entries = [
      { path: "[Content_Types].xml", data: encoder.encode("<a/>") },
      { path: "word/document.xml", data: encoder.encode("<b>hello</b>") },
    ];
    const first = zip(entries);
    const second = zip(entries);
    expect(first).toEqual(second);
  });

  it("round-trips UTF-8 path names and keeps [Content_Types].xml first", () => {
    const archive = zip([
      { path: "[Content_Types].xml", data: encoder.encode("<a/>") },
      { path: "word/résumé.xml", data: encoder.encode("<b/>") },
    ]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    const firstNameLength = view.getUint16(26, true);
    const firstName = new TextDecoder().decode(archive.slice(30, 30 + firstNameLength));
    expect(firstName).toBe("[Content_Types].xml");

    const text = new TextDecoder().decode(archive);
    expect(text).toContain("word/résumé.xml");
  });

  it("uses the stored method with matching compressed and uncompressed sizes", () => {
    const data = encoder.encode("some uncompressed content");
    const archive = zip([{ path: "a.xml", data }]);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

    expect(view.getUint16(8, true)).toBe(0); // compression method: stored
    expect(view.getUint32(18, true)).toBe(data.length); // compressed size
    expect(view.getUint32(22, true)).toBe(data.length); // uncompressed size
  });
});
