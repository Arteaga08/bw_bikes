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

  it("renders both the mobile card list and the table when mobileRow is given, hiding the table below md", () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} mobileRow={(row) => <span>{row.label} card</span>} />,
    );

    expect(screen.getByText("Best Seller card")).toBeInTheDocument();
    expect(screen.getByText("Novedades card")).toBeInTheDocument();

    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(table?.parentElement).toHaveClass("hidden", "md:block");
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
