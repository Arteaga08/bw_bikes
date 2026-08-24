import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, DataTableSkeleton, type DataTableColumn } from "./DataTable";

interface Row {
  id: string;
  label: string;
}

const rows: Row[] = [
  { id: "1", label: "Best Seller" },
  { id: "2", label: "Novedades" },
];

const columns: DataTableColumn<Row>[] = [{ key: "label", header: "Etiqueta", kind: "text", render: (row) => row.label }];

describe("DataTable", () => {
  it("renders only the table when no mobileRow is given, unchanged from before mobileRow existed", () => {
    const { container } = render(<DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />);

    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("table")?.parentElement).not.toHaveClass("hidden");
    expect(screen.getByText("Best Seller").closest("td")).toBeInTheDocument();
  });

  /** `vitest.setup.ts`'s shared `matchMedia` stub defaults to desktop (`matches: true`) — override it locally to exercise the mobile layout. */
  function mockMatches(matches: boolean): () => void {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    return () => {
      window.matchMedia = originalMatchMedia;
    };
  }

  // Below `md`, only the card list mounts — the table isn't in the DOM at
  // all, not just hidden by CSS. That's the whole point of this change: a
  // `mobileRow` table used to render both layouts and hide one with
  // `md:hidden`, so every row (and every `column.render(row)` call) paid
  // twice.
  it("renders only the mobile card list when mobileRow is given and the viewport doesn't match md", () => {
    const restore = mockMatches(false);
    try {
      const { container } = render(
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} mobileRow={(row) => <span>{row.label} card</span>} />,
      );

      expect(screen.getByText("Best Seller card")).toBeInTheDocument();
      expect(screen.getByText("Novedades card")).toBeInTheDocument();
      expect(container.querySelector("table")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("renders only the table when mobileRow is given and the viewport matches md", () => {
    const restore = mockMatches(true);
    try {
      const { container } = render(
        <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} mobileRow={(row) => <span>{row.label} card</span>} />,
      );

      expect(container.querySelector("table")).toBeInTheDocument();
      expect(screen.getByText("Best Seller").closest("td")).toBeInTheDocument();
      expect(screen.queryByText("Best Seller card")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});

describe("DataTableSkeleton", () => {
  it("renders only the table shell when mobile is not set", () => {
    const { container } = render(<DataTableSkeleton columns={columns} rows={3} />);

    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("table")?.parentElement).not.toHaveClass("hidden");
    expect(container.children).toHaveLength(1);
  });

  it("renders mobile skeleton rows plus a table hidden below md when mobile is set", () => {
    const { container } = render(<DataTableSkeleton columns={columns} rows={3} mobile />);

    const mobileShell = container.firstElementChild;
    expect(mobileShell).toHaveClass("md:hidden");
    expect(mobileShell?.children).toHaveLength(3);

    const table = container.querySelector("table");
    expect(table?.parentElement).toHaveClass("hidden", "md:block");
  });
});
