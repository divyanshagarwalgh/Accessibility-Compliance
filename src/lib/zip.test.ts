import { describe, expect, it } from "vitest";
import { crc32, zip } from "./zip";

const u32 = (bytes: Uint8Array, at: number) =>
  bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | ((bytes[at + 3]! << 24) >>> 0);
const u16 = (bytes: Uint8Array, at: number) => bytes[at]! | (bytes[at + 1]! << 8);

describe("crc32", () => {
  // The canonical check value from the CRC-32 specification. If this drifts,
  // every archive we produce is quietly corrupt in a way Word reports as
  // "unreadable content" without saying why.
  it("matches the standard check value for \"123456789\"", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("is 0 for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("zip", () => {
  const archive = zip([
    { name: "[Content_Types].xml", content: "<Types/>" },
    { name: "word/document.xml", content: "<w:document/>" },
  ]);

  it("starts with a local file header", () => {
    expect(u32(archive, 0)).toBe(0x04034b50);
  });

  it("ends with an end-of-central-directory record naming every entry", () => {
    const eocdAt = archive.length - 22;
    expect(u32(archive, eocdAt)).toBe(0x06054b50);
    expect(u16(archive, eocdAt + 8)).toBe(2); // entries on this disk
    expect(u16(archive, eocdAt + 10)).toBe(2); // entries total
  });

  it("points the central directory at a real header", () => {
    const eocdAt = archive.length - 22;
    const centralStart = u32(archive, eocdAt + 16);
    expect(u32(archive, centralStart)).toBe(0x02014b50);
  });

  it("stores rather than compresses, so both sizes match the payload", () => {
    const payload = new TextEncoder().encode("<Types/>");
    expect(u16(archive, 8)).toBe(0); // compression method 0
    expect(u32(archive, 18)).toBe(payload.length); // compressed size
    expect(u32(archive, 22)).toBe(payload.length); // uncompressed size
  });

  it("flags names as UTF-8", () => {
    expect(u16(archive, 6) & 0x0800).toBe(0x0800);
  });

  it("keeps the payload retrievable at the offset the header describes", () => {
    const nameLength = u16(archive, 26);
    const extraLength = u16(archive, 28);
    const start = 30 + nameLength + extraLength;
    const text = new TextDecoder().decode(archive.subarray(start, start + 8));
    expect(text).toBe("<Types/>");
  });

  it("is byte-identical for identical input", () => {
    // No timestamps anywhere, so a re-export of an unchanged document is the
    // same file rather than a new one.
    const again = zip([
      { name: "[Content_Types].xml", content: "<Types/>" },
      { name: "word/document.xml", content: "<w:document/>" },
    ]);
    expect(Array.from(again)).toEqual(Array.from(archive));
  });

  it("handles an empty archive", () => {
    const empty = zip([]);
    expect(empty.length).toBe(22);
    expect(u32(empty, 0)).toBe(0x06054b50);
  });
});
