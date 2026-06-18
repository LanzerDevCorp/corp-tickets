import { describe, it, expect } from "vitest";
import { ticketSubmitSchema } from "./ticket-submit";

const VALID = {
  name: "Ana López",
  email: "ana@empresa.com",
  subject: "No puedo entrar al sistema",
  body: "Desde esta mañana no puedo iniciar sesión. Ya reinicié y sigue igual.",
  priority: "medium" as const,
  category_id: "550e8400-e29b-41d4-a716-446655440000",
  turnstile_token: "test-token",
};

describe("ticketSubmitSchema", () => {
  it("acepta datos válidos", () => {
    expect(ticketSubmitSchema.safeParse(VALID).success).toBe(true);
  });

  it("aplica default 'medium' cuando priority no se pasa", () => {
    const { priority: _, ...noP } = VALID;
    const res = ticketSubmitSchema.safeParse(noP);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.priority).toBe("medium");
  });

  describe("name", () => {
    it("rechaza nombre con 1 caracter", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, name: "A" });
      expect(res.success).toBe(false);
    });

    it("rechaza nombre vacío", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, name: "" });
      expect(res.success).toBe(false);
    });

    it("rechaza nombre mayor a 100 caracteres", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, name: "a".repeat(101) });
      expect(res.success).toBe(false);
    });
  });

  describe("email", () => {
    it("rechaza correo sin @", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, email: "noatemail" });
      expect(res.success).toBe(false);
    });

    it("acepta correo con subdominio", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, email: "u@corp.empresa.mx" });
      expect(res.success).toBe(true);
    });
  });

  describe("subject", () => {
    it("rechaza asunto menor a 3 caracteres", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, subject: "Ab" });
      expect(res.success).toBe(false);
    });
  });

  describe("body", () => {
    it("rechaza descripción menor a 10 caracteres", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, body: "corto" });
      expect(res.success).toBe(false);
    });

    it("rechaza descripción mayor a 5000 caracteres", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, body: "a".repeat(5001) });
      expect(res.success).toBe(false);
    });
  });

  describe("priority", () => {
    it("rechaza prioridad desconocida", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, priority: "critical" });
      expect(res.success).toBe(false);
    });

    it("acepta todas las prioridades válidas", () => {
      for (const p of ["low", "medium", "high", "urgent"]) {
        expect(ticketSubmitSchema.safeParse({ ...VALID, priority: p }).success).toBe(true);
      }
    });
  });

  describe("category_id", () => {
    it("rechaza un ID que no es UUID", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, category_id: "not-a-uuid" });
      expect(res.success).toBe(false);
    });

    it("acepta un UUID válido", () => {
      const res = ticketSubmitSchema.safeParse({
        ...VALID,
        category_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("turnstile_token", () => {
    it("rechaza token vacío", () => {
      const res = ticketSubmitSchema.safeParse({ ...VALID, turnstile_token: "" });
      expect(res.success).toBe(false);
    });
  });

  it("recorta espacios en nombre, asunto y descripción", () => {
    const res = ticketSubmitSchema.safeParse({
      ...VALID,
      name: "  Ana  ",
      subject: "  Problema  ",
      body: "  Descripción larga suficiente  ",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Ana");
      expect(res.data.subject).toBe("Problema");
    }
  });
});
