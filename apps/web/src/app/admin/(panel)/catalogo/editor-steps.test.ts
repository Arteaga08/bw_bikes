import { describe, expect, it } from "vitest";
import {
  EDITOR_STEPS,
  type EditorStepId,
  firstStepWithErrors,
  type FormErrors,
  getStepStatus,
  stepForErrorKey,
  stepHasErrors,
  stepIdAt,
  stepIndex,
} from "./editor-steps";

describe("EDITOR_STEPS", () => {
  it("has exactly the 5 steps in order", () => {
    expect(EDITOR_STEPS.map((step) => step.id)).toEqual(["basics", "variants", "specs", "images", "review"]);
  });
});

describe("stepIndex / stepIdAt", () => {
  it("round-trips a step id through its index", () => {
    for (const step of EDITOR_STEPS) {
      expect(stepIdAt(stepIndex(step.id))).toBe(step.id);
    }
  });

  it("clamps out-of-range indices instead of returning undefined", () => {
    expect(stepIdAt(-1)).toBe("basics");
    expect(stepIdAt(99)).toBe("review");
  });
});

describe("stepForErrorKey", () => {
  it("maps a basics field to the basics step", () => {
    expect(stepForErrorKey("name")).toBe("basics");
    expect(stepForErrorKey("shortDescription")).toBe("basics");
  });

  it("maps the variants key to the variants step", () => {
    expect(stepForErrorKey("variants")).toBe("variants");
  });
});

describe("stepHasErrors", () => {
  it("is true when the step owns a key with a message", () => {
    const errors: FormErrors = { name: "El nombre es obligatorio." };
    expect(stepHasErrors(errors, "basics")).toBe(true);
  });

  it("is false when the step owns no key with a message", () => {
    const errors: FormErrors = { variants: "Hay SKU repetidos." };
    expect(stepHasErrors(errors, "basics")).toBe(false);
  });

  it("is false for steps that own no validated key at all", () => {
    const errors: FormErrors = { name: "El nombre es obligatorio.", variants: "Hay SKU repetidos." };
    expect(stepHasErrors(errors, "specs")).toBe(false);
    expect(stepHasErrors(errors, "images")).toBe(false);
    expect(stepHasErrors(errors, "review")).toBe(false);
  });
});

describe("firstStepWithErrors", () => {
  it("returns the earliest step (in order) that owns an error", () => {
    const errors: FormErrors = { variants: "Hay SKU repetidos.", name: "El nombre es obligatorio." };
    expect(firstStepWithErrors(errors)).toBe("basics");
  });

  it("returns undefined when there are no errors", () => {
    expect(firstStepWithErrors({})).toBeUndefined();
  });
});

describe("getStepStatus", () => {
  const noVisited: ReadonlySet<EditorStepId> = new Set();

  it("is 'error' whenever the step owns a current error, regardless of visited/current", () => {
    const errors: FormErrors = { name: "El nombre es obligatorio." };
    expect(
      getStepStatus("basics", { errors, visitedSteps: new Set(["basics"]), currentStepId: "variants" }),
    ).toBe("error");
  });

  it("is 'pending' for the step currently being viewed, even if visited", () => {
    expect(
      getStepStatus("basics", { errors: {}, visitedSteps: new Set(["basics"]), currentStepId: "basics" }),
    ).toBe("pending");
  });

  it("is 'complete' for an error-free step that's been passed and isn't the current one", () => {
    expect(
      getStepStatus("basics", { errors: {}, visitedSteps: new Set(["basics"]), currentStepId: "variants" }),
    ).toBe("complete");
  });

  it("is 'pending' for a step never visited", () => {
    expect(getStepStatus("review", { errors: {}, visitedSteps: noVisited, currentStepId: "basics" })).toBe(
      "pending",
    );
  });
});
