import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShipmentForm } from "./ShipmentForm";

describe("ShipmentForm", () => {
  it("submits with just a tracking number for a known carrier (dhl)", () => {
    const onSubmit = vi.fn();
    render(<ShipmentForm onSubmit={onSubmit} submitting={false} success={false} willTransitionToShipped />);

    fireEvent.change(screen.getByLabelText("Número de guía"), { target: { value: "1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Capturar guía y marcar como enviada" }));

    expect(onSubmit).toHaveBeenCalledWith({ carrier: "dhl", trackingNumber: "1234567890" });
  });

  it("does not show carrierName/trackingUrl fields for a known carrier", () => {
    render(<ShipmentForm onSubmit={vi.fn()} submitting={false} success={false} willTransitionToShipped />);
    expect(screen.queryByLabelText("Nombre de la paquetería")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("URL de rastreo")).not.toBeInTheDocument();
  });

  it("requires carrierName and trackingUrl when carrier is 'otro', and blocks submit without them", () => {
    const onSubmit = vi.fn();
    render(<ShipmentForm onSubmit={onSubmit} submitting={false} success={false} willTransitionToShipped />);

    fireEvent.change(screen.getByLabelText("Paquetería"), { target: { value: "otro" } });
    fireEvent.change(screen.getByLabelText("Número de guía"), { target: { value: "ABC12345" } });

    const submit = screen.getByRole("button", { name: "Capturar guía y marcar como enviada" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nombre de la paquetería"), { target: { value: "Mensajería Local" } });
    fireEvent.change(screen.getByLabelText("URL de rastreo"), { target: { value: "https://ejemplo.com/track" } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({
      carrier: "otro",
      trackingNumber: "ABC12345",
      carrierName: "Mensajería Local",
      trackingUrl: "https://ejemplo.com/track",
    });
  });

  it("labels the submit button as a correction when the order is already shipped", () => {
    render(<ShipmentForm onSubmit={vi.fn()} submitting={false} success={false} willTransitionToShipped={false} />);
    expect(screen.getByRole("button", { name: "Actualizar guía" })).toBeInTheDocument();
  });
});
