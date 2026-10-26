// @vitest-environment node

/**
 * Undo toasts — S4 contract (undo half).
 *
 * A reversible administrative action confirms itself with a toast that offers
 * "Deshacer"; invoking it runs the inverse action and reports its own outcome,
 * so a mis-tap on a phone costs one more tap instead of a support call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

import {
  UNDO_TOAST_DURATION_MS,
  showUndoableAction,
} from "./undo-toast";
import { UNDO_MESSAGES } from "@/lib/localization/es-ec";

interface ToastAction {
  label: string;
  onClick: () => void;
}

function lastAction(): ToastAction {
  const options = mocks.success.mock.calls.at(-1)?.[1] as {
    action: ToastAction;
  };
  return options.action;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("showUndoableAction", () => {
  it("confirms the action with a long-lived undo affordance", () => {
    showUndoableAction({
      message: "Estudiante desactivado.",
      undoneMessage: "Deshecho.",
      failedMessage: "Falló.",
      undo: vi.fn(),
    });

    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.success.mock.calls[0][0]).toBe("Estudiante desactivado.");
    expect(lastAction().label).toBe(UNDO_MESSAGES.UNDO_LABEL);
    expect(
      (mocks.success.mock.calls[0][1] as { duration: number }).duration
    ).toBe(UNDO_TOAST_DURATION_MS);
  });

  it("runs the inverse action and confirms the undo", async () => {
    const undo = vi.fn().mockResolvedValue({ success: true });

    showUndoableAction({
      message: "Estudiante desactivado.",
      undoneMessage: "El estudiante vuelve a estar activo.",
      failedMessage: "Falló.",
      undo,
    });

    await lastAction().onClick();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(
      "El estudiante vuelve a estar activo."
    );
  });

  it("reports a rejected inverse with its own message", async () => {
    const undo = vi
      .fn()
      .mockResolvedValue({ success: false, error: "No autorizado" });

    showUndoableAction({
      message: "Estudiante desactivado.",
      undoneMessage: "Deshecho.",
      failedMessage: "No se pudo deshacer.",
      undo,
    });

    await lastAction().onClick();

    expect(mocks.error).toHaveBeenCalledWith("No autorizado");
  });

  it("falls back to the generic failure message when the inverse throws", async () => {
    const undo = vi.fn().mockRejectedValue(new Error("boom"));

    showUndoableAction({
      message: "Estudiante desactivado.",
      undoneMessage: "Deshecho.",
      failedMessage: "No se pudo deshacer.",
      undo,
    });

    await lastAction().onClick();

    expect(mocks.error).toHaveBeenCalledWith("No se pudo deshacer.");
  });

  it("prefers the caller's failure copy when the inverse fails silently", async () => {
    const undo = vi.fn().mockResolvedValue({ success: false });

    showUndoableAction({
      message: "Clase suspendida.",
      undoneMessage: "Deshecho.",
      failedMessage: "No se pudo deshacer la suspensión.",
      undo,
    });

    await lastAction().onClick();

    expect(mocks.error).toHaveBeenCalledWith(
      "No se pudo deshacer la suspensión."
    );
  });
});
