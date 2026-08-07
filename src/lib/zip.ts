/**
 * A minimal ZIP writer, because a `.docx` is a ZIP.
 *
 * ## Why this is hand-written rather than a dependency
 *
 * The document generators run inside the Workers runtime, which has no `fs`, no
 * `Buffer` and no `zlib`. Most zip libraries reach for at least one of those.
 * The ones that do not are still a few tens of kilobytes against a 10 MB worker
 * ceiling that also has to hold Next.js — and all we need from them is a
 * container format that Word will open.
 *
 * ## Why entries are stored rather than deflated
 *
 * `CompressionStream("deflate-raw")` exists in Workers and would shrink these
 * files by roughly 80%. It is also async, which would make every call site
 * async, and it puts a streaming API on the critical path of a document a user
 * is waiting to download. A VPAT is about 60 KB of XML uncompressed. That is not
 * worth the complexity, and the ZIP spec has always allowed method 0.
 *
 * The format written here is the classic 1989 layout: a local header per entry,
 * a central directory, and an end-of-central-directory record. No ZIP64, no data
 * descriptors — neither is reachable at these sizes.
 */

export type ZipEntry = {
  /** Path inside the archive, e.g. "word/document.xml". Always forward slashes. */
  name: string;
  content: string | Uint8Array;
};

/** Bit 11 of the general purpose flags: the file name is UTF-8. */
const UTF8_FLAG = 0x0800;

/**
 * MS-DOS date for 1980-01-01 00:00, the epoch of the format.
 *
 * Deliberately fixed rather than `new Date()`: a document generated twice from
 * the same input should be byte-identical, which makes the output testable and
 * means a re-export does not look like a different file.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Grows on demand and writes little-endian, which is all ZIP uses. */
class ByteWriter {
  private buffer = new Uint8Array(1024);
  private length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }

  u16(value: number) {
    this.ensure(2);
    this.buffer[this.length++] = value & 0xff;
    this.buffer[this.length++] = (value >>> 8) & 0xff;
  }

  u32(value: number) {
    this.ensure(4);
    this.buffer[this.length++] = value & 0xff;
    this.buffer[this.length++] = (value >>> 8) & 0xff;
    this.buffer[this.length++] = (value >>> 16) & 0xff;
    this.buffer[this.length++] = (value >>> 24) & 0xff;
  }

  bytes(value: Uint8Array) {
    this.ensure(value.length);
    this.buffer.set(value, this.length);
    this.length += value.length;
  }

  get offset(): number {
    return this.length;
  }

  // The `<ArrayBuffer>` argument is not noise: the default `ArrayBufferLike`
  // admits a SharedArrayBuffer, which `Response` will not accept as a body. The
  // writer always owns a plain buffer, so saying so keeps callers cast-free.
  finish(): Uint8Array<ArrayBuffer> {
    return this.buffer.slice(0, this.length);
  }
}

/**
 * Packs entries into a ZIP archive.
 *
 * Entry order is preserved. For OOXML that matters by convention rather than by
 * spec — `[Content_Types].xml` first is what every other producer does, and some
 * consumers have been known to assume it.
 */
export function zip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const out = new ByteWriter();

  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const data =
      typeof entry.content === "string" ? encoder.encode(entry.content) : entry.content;
    return { nameBytes, data, crc: crc32(data), offset: 0 };
  });

  for (const entry of prepared) {
    entry.offset = out.offset;
    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(UTF8_FLAG);
    out.u16(0); // stored
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(entry.crc);
    out.u32(entry.data.length); // compressed size == uncompressed, method 0
    out.u32(entry.data.length);
    out.u16(entry.nameBytes.length);
    out.u16(0); // no extra field
    out.bytes(entry.nameBytes);
    out.bytes(entry.data);
  }

  const centralStart = out.offset;

  for (const entry of prepared) {
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(UTF8_FLAG);
    out.u16(0);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(entry.crc);
    out.u32(entry.data.length);
    out.u32(entry.data.length);
    out.u16(entry.nameBytes.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number start
    out.u16(0); // internal attributes
    out.u32(0); // external attributes
    out.u32(entry.offset);
    out.bytes(entry.nameBytes);
  }

  const centralSize = out.offset - centralStart;

  out.u32(0x06054b50); // end of central directory
  out.u16(0); // this disk
  out.u16(0); // disk with the central directory
  out.u16(prepared.length);
  out.u16(prepared.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0); // comment length

  return out.finish();
}
