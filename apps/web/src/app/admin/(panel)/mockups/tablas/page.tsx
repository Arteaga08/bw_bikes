import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  type DataTableColumn,
  TableRowActions,
} from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { MOCK_SPEC_TEMPLATES, type MockSpecTemplateRow } from "../fixtures";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="font-display text-h3 text-negro">{title}</h2>
        <p className="max-w-[65ch] font-body text-caption text-grafito">
          {note}
        </p>
      </div>
      {children}
    </section>
  );
}

/**
 * The rule applied via the real `DataTable`/`align` today — a preview of
 * what `kind` would encode by default once it exists. No production code
 * changes: `align` already supports this.
 */
const RULE_COLUMNS: DataTableColumn<MockSpecTemplateRow>[] = [
  { key: "title", header: "Título", align: "left", render: (row) => row.title },
  {
    key: "fields",
    header: "Campos",
    align: "right",
    render: (row) => String(row.fieldCount),
  },
  {
    key: "source",
    header: "Origen",
    align: "left",
    render: (row) => (
      <Badge variant="neutral">
        {row.source === "manual" ? "Manual" : "Automática"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Estatus",
    align: "left",
    render: (row) =>
      row.isActive ? (
        <Badge variant="exito">Activa</Badge>
      ) : (
        <Badge variant="neutral">Inactiva</Badge>
      ),
  },
  {
    key: "actions",
    header: "Acciones",
    align: "right",
    className: "w-px whitespace-nowrap",
    render: () => (
      <TableRowActions>
        <Button variant="secondary" size="sm">
          Editar
        </Button>
        <Button variant="ghost" size="sm">
          Eliminar
        </Button>
      </TableRowActions>
    ),
  },
];

/** A column's semantic type — what `DataTableColumn.kind` would encode; `align` is the value it implies. */
type ColumnKind = "text" | "number" | "status" | "actions";

const KIND_ALIGN: Record<ColumnKind, "left" | "right"> = {
  text: "left",
  number: "right",
  status: "left",
  actions: "right",
};

interface SeparatorDemoColumn {
  key: string;
  header: string;
  kind: ColumnKind;
  render: (row: MockSpecTemplateRow) => ReactNode;
}

const SEPARATOR_COLUMNS: SeparatorDemoColumn[] = [
  { key: "title", header: "Título", kind: "text", render: (row) => row.title },
  {
    key: "fields",
    header: "Campos",
    kind: "number",
    render: (row) => String(row.fieldCount),
  },
  {
    key: "source",
    header: "Origen",
    kind: "status",
    render: (row) => (
      <Badge variant="neutral">
        {row.source === "manual" ? "Manual" : "Automática"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Estatus",
    kind: "status",
    render: (row) =>
      row.isActive ? (
        <Badge variant="exito">Activa</Badge>
      ) : (
        <Badge variant="neutral">Inactiva</Badge>
      ),
  },
];

const ALIGN_CLASS: Record<"left" | "right", string> = {
  left: "text-left",
  right: "text-right",
};

/**
 * Hand-rolled, not `DataTable` — `DataTableColumn.className` only reaches
 * `<td>`, never `<th>` (`DataTable.tsx:77-81` vs `:108-111`), so a
 * header-only rule can't be previewed through the real component's current
 * API. Classes otherwise match `DataTable`/`TableHead` byte-for-byte.
 */
function SeparatorDemoTable({
  treatment,
}: {
  treatment: "loose" | "header-rule" | "full-rule";
}) {
  const thPad = treatment === "loose" ? "px-lg" : "px-md";
  const tdPad = treatment === "loose" ? "px-lg" : "px-md";

  return (
    <div className="overflow-x-auto rounded-card border border-borde bg-surface">
      <table className="w-full min-w-144 table-auto border-collapse text-left">
        <thead>
          <tr className="border-b border-borde bg-base">
            {SEPARATOR_COLUMNS.map((column, index) => {
              const isLast = index === SEPARATOR_COLUMNS.length - 1;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`${thPad} py-sm font-ui text-caption uppercase tracking-[1px] text-grafito ${ALIGN_CLASS[KIND_ALIGN[column.kind]]} ${
                    treatment === "header-rule" && !isLast
                      ? "border-r border-borde"
                      : ""
                  }`}
                >
                  {column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {MOCK_SPEC_TEMPLATES.map((row) => (
            <tr
              key={row.id}
              className="border-b border-borde last:border-b-0 hover:bg-base"
            >
              {SEPARATOR_COLUMNS.map((column, index) => {
                const isLast = index === SEPARATOR_COLUMNS.length - 1;
                return (
                  <td
                    key={column.key}
                    className={`${tdPad} py-sm font-body text-body text-negro ${ALIGN_CLASS[KIND_ALIGN[column.kind]]} ${
                      treatment === "full-rule" && !isLast
                        ? "border-r border-borde"
                        : ""
                    }`}
                  >
                    {column.render(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TablasMockupPage() {
  return (
    <>
      <PageHeader
        title="Encabezados de tabla"
        subtitle="Punto 8b — regla de alineación por tipo de columna, y tres tratamientos de separación entre columnas."
      />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <Section
          title="La regla — DataTable real, columnas de Fichas técnicas"
          note="Texto a la izquierda, número a la derecha, estado a la izquierda (es categórico, no numérico), acciones a la derecha. Ya construida con la prop align que DataTable tiene hoy — el trabajo real es codificarla como kind para que dejar de elegirla bien no sea el camino fácil."
        >
          <DataTable
            columns={RULE_COLUMNS}
            rows={MOCK_SPEC_TEMPLATES}
            getRowKey={(row) => row.id}
          />
        </Section>

        <Section
          title="Separación — tres tratamientos, mismas columnas"
          note="Hoy no hay ninguna: Origen/Estatus y cualquier par de columnas se leen pegadas. De más sutil a más marcado."
        >
          <div className="flex flex-col gap-lg">
            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">
                A · Solo más aire (px-lg, sin filete)
              </p>
              <SeparatorDemoTable treatment="loose" />
            </div>
            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">
                B · Filete solo en el encabezado (recomendado)
              </p>
              <SeparatorDemoTable treatment="header-rule" />
            </div>
            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">
                C · Filete de altura completa
              </p>
              <SeparatorDemoTable treatment="full-rule" />
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
