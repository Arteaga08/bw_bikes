import type { ProductImage } from "@bw-bikes/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductGallery } from "./ProductGallery";

function image(order: number): ProductImage {
  return { publicId: `img-${order}`, url: `https://res.cloudinary.com/demo/image/upload/img-${order}.jpg`, width: 800, height: 800, order };
}

describe("ProductGallery", () => {
  it("renders a neutral placeholder frame when the product has no photos", () => {
    render(<ProductGallery images={[]} productName="Bici" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a single full-width tile for one photo", () => {
    render(<ProductGallery images={[image(0)]} productName="Bici" />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText(/Ver más/)).not.toBeInTheDocument();
  });

  it("renders every tile up to 4 with no 'Ver más' overlay", () => {
    render(<ProductGallery images={[image(0), image(1), image(2)]} productName="Bici" />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.queryByText(/Ver más/)).not.toBeInTheDocument();
  });

  it("shows a 'Ver más' overlay with the remaining count past 4 photos", () => {
    const images = [image(0), image(1), image(2), image(3), image(4), image(5)];
    render(<ProductGallery images={images} productName="Bici" />);

    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByText("Ver más (+2)")).toBeInTheDocument();
  });

  it("expands the remaining photos inline (no modal) and collapses back", () => {
    const images = [image(0), image(1), image(2), image(3), image(4), image(5)];
    render(<ProductGallery images={images} productName="Bici" />);

    fireEvent.click(screen.getByText("Ver más (+2)"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(6);
    expect(screen.getByText("Ver menos")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ver menos"));

    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByText("Ver más (+2)")).toBeInTheDocument();
  });

  it("gives a lone leftover photo (odd remainder) a full-width row when expanded", () => {
    const images = [image(0), image(1), image(2), image(3), image(4)];
    render(<ProductGallery images={images} productName="Bici" />);

    fireEvent.click(screen.getByText("Ver más (+1)"));

    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
});
