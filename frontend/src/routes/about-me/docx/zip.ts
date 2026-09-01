/**
 * A minimal, store-only (uncompressed) ZIP writer.
 *
 * A .docx is a ZIP of XML parts, and the whole package here is ~70 KB - too
 * small for DEFLATE to be worth a dependency. Word and LibreOffice both open
 * stored (method 0) entries; the OPC spec permits them.
 *
 * Output is fully deterministic: every entry gets the fixed 1980-01-01
 * DOS timestamp rather than the current time, so the same résumé built twice
 * is byte-identical and tests can assert on exact output.
 */

export type ZipEntry = { path: string; data: Uint8Array };

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

// Version 2.0, method 0 (stored) - the minimum any unzip implementation needs.
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 20;
const COMPRESSION_METHOD_STORED = 0;

// UTF-8 filenames, per the general-purpose bit flag's "language encoding flag".
const GENERAL_PURPOSE_FLAG = 0x0800;

// DOS date 1980-01-01, DOS time 00:00:00 - the epoch of the format itself.
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;

const LOCAL_FILE_HEADER_SIZE = 30;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

let crcTable: Uint32Array | undefined;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/** CRC-32 (ISO 3309 / ITU-T V.42), the checksum ZIP entries carry. */
export function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Pack entries into a store-only ZIP archive.
 *
 * `entries` order is preserved in the archive; callers that need
 * `[Content_Types].xml` first (the OPC convention) must put it first
 * themselves.
 */
export function zip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.path);
    return {
      nameBytes,
      data: entry.data,
      crc: crc32(entry.data),
    };
  });

  let totalSize = 0;
  for (const entry of prepared) {
    totalSize += LOCAL_FILE_HEADER_SIZE + entry.nameBytes.length + entry.data.length;
  }
  for (const entry of prepared) {
    totalSize += CENTRAL_DIRECTORY_HEADER_SIZE + entry.nameBytes.length;
  }
  totalSize += END_OF_CENTRAL_DIRECTORY_SIZE;

  const buffer = new ArrayBuffer(totalSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;

  const localHeaderOffsets: number[] = [];

  for (const entry of prepared) {
    localHeaderOffsets.push(offset);

    view.setUint32(offset, LOCAL_FILE_HEADER_SIGNATURE, true);
    view.setUint16(offset + 4, VERSION_NEEDED, true);
    view.setUint16(offset + 6, GENERAL_PURPOSE_FLAG, true);
    view.setUint16(offset + 8, COMPRESSION_METHOD_STORED, true);
    view.setUint16(offset + 10, DOS_TIME, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // extra field length
    offset += LOCAL_FILE_HEADER_SIZE;

    bytes.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;

    bytes.set(entry.data, offset);
    offset += entry.data.length;
  }

  const centralDirectoryOffset = offset;

  prepared.forEach((entry, i) => {
    view.setUint32(offset, CENTRAL_DIRECTORY_HEADER_SIGNATURE, true);
    view.setUint16(offset + 4, VERSION_MADE_BY, true);
    view.setUint16(offset + 6, VERSION_NEEDED, true);
    view.setUint16(offset + 8, GENERAL_PURPOSE_FLAG, true);
    view.setUint16(offset + 10, COMPRESSION_METHOD_STORED, true);
    view.setUint16(offset + 12, DOS_TIME, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // extra field length
    view.setUint16(offset + 32, 0, true); // file comment length
    view.setUint16(offset + 34, 0, true); // disk number start
    view.setUint16(offset + 36, 0, true); // internal file attributes
    view.setUint32(offset + 38, 0, true); // external file attributes
    view.setUint32(offset + 42, localHeaderOffsets[i]!, true);
    offset += CENTRAL_DIRECTORY_HEADER_SIZE;

    bytes.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  });

  const centralDirectorySize = offset - centralDirectoryOffset;

  view.setUint32(offset, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(offset + 4, 0, true); // number of this disk
  view.setUint16(offset + 6, 0, true); // disk where central directory starts
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, centralDirectorySize, true);
  view.setUint32(offset + 16, centralDirectoryOffset, true);
  view.setUint16(offset + 20, 0, true); // comment length
  offset += END_OF_CENTRAL_DIRECTORY_SIZE;

  return bytes;
}
