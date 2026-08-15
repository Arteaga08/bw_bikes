import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tab, TabList } from "./Tabs";

function renderStrip(onSelect: (value: string) => void, selected = "queue") {
  return render(
    <TabList label="Vistas de órdenes">
      <Tab selected={selected === "queue"} onSelect={() => onSelect("queue")} badge="3">
        Cola de proveedor
      </Tab>
      <Tab selected={selected === "all"} onSelect={() => onSelect("all")}>
        Todas
      </Tab>
    </TabList>,
  );
}

describe("Tabs", () => {
  it("uses tab semantics, not navigation semantics — these switch a table in place, not the route", () => {
    renderStrip(vi.fn());

    expect(screen.getByRole("tablist", { name: "Vistas de órdenes" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[0]).not.toHaveAttribute("aria-current");
  });

  it("is a single stop in the tab order — only the selected tab is focusable", () => {
    renderStrip(vi.fn());
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
  });

  it("moves between tabs with the arrow keys and selects as it goes", async () => {
    const onSelect = vi.fn();
    renderStrip(onSelect);

    const tabs = screen.getAllByRole("tab");
    tabs[0]?.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("all");
    expect(tabs[1]).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("queue");
    expect(tabs[0]).toHaveFocus();
  });

  it("jumps to the ends with Home and End", async () => {
    const onSelect = vi.fn();
    renderStrip(onSelect);

    const tabs = screen.getAllByRole("tab");
    tabs[0]?.focus();

    await userEvent.keyboard("{End}");
    expect(tabs[1]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("all");

    await userEvent.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("queue");
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    renderStrip(onSelect);

    await userEvent.click(screen.getByRole("tab", { name: /Todas/ }));
    expect(onSelect).toHaveBeenCalledWith("all");
  });

  it("renders the badge inside the tab's accessible name so the count is announced with it", () => {
    renderStrip(vi.fn());
    expect(screen.getByRole("tab", { name: "Cola de proveedor 3" })).toBeInTheDocument();
  });
});
