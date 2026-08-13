import type { ProductImage } from "@bw-bikes/shared";
import { describe, expect, it } from "vitest";
import { moveImage } from "./gallery";

function image(publicId: string): ProductImage {
  return { publicId, url: `https://example.com/${publicId}.jpg`, width: 800, height: 800, order: 0 };
}

describe("moveImage", () => {
  it("moves an image from one index to another, shifting the rest", () => {
    const gallery = [image("a"), image("b"), image("c")];
    expect(moveImage(gallery, 2, 0).map((img) => img.publicId)).toEqual(["c", "a", "b"]);
    expect(moveImage(gallery, 0, 2).map((img) => img.publicId)).toEqual(["b", "c", "a"]);
  });

  it("is a no-op when the target index is unchanged", () => {
    const gallery = [image("a"), image("b")];
    expect(moveImage(gallery, 1, 1).map((img) => img.publicId)).toEqual(["a", "b"]);
  });

  it("clamps out-of-range targets instead of throwing", () => {
    const gallery = [image("a"), image("b"), image("c")];
    expect(moveImage(gallery, 0, 99).map((img) => img.publicId)).toEqual(["b", "c", "a"]);
    expect(moveImage(gallery, 2, -5).map((img) => img.publicId)).toEqual(["c", "a", "b"]);
  });

  it("never mutates the input array", () => {
    const gallery = [image("a"), image("b")];
    moveImage(gallery, 0, 1);
    expect(gallery.map((img) => img.publicId)).toEqual(["a", "b"]);
  });
});
