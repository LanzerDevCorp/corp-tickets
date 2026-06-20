import { describe, it, expect } from "vitest";
import {
  formatTicketReference,
  isValidTicketReferenceInput,
  normalizeTicketReferenceInput,
  ticketMatchesReference,
} from "../reference";

describe("ticket reference helpers", () => {
  const ticketId = "6087bb67-a0e1-4bca-86d9-568137c7e38f";

  it("formats short reference from uuid", () => {
    expect(formatTicketReference(ticketId)).toBe("6087BB67");
  });

  it("normalizes user input", () => {
    expect(normalizeTicketReferenceInput("#6087BB67")).toBe("6087bb67");
  });

  it("validates short and full uuid references", () => {
    expect(isValidTicketReferenceInput("6087BB67")).toBe(true);
    expect(isValidTicketReferenceInput(ticketId)).toBe(true);
    expect(isValidTicketReferenceInput("abc")).toBe(false);
  });

  it("matches ticket by short reference", () => {
    expect(ticketMatchesReference(ticketId, "6087BB67")).toBe(true);
    expect(ticketMatchesReference(ticketId, "#6087bb67")).toBe(true);
    expect(ticketMatchesReference(ticketId, ticketId)).toBe(true);
    expect(ticketMatchesReference(ticketId, "99999999")).toBe(false);
  });
});
