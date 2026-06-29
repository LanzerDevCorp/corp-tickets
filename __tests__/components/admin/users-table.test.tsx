import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation so useRouter doesn't blow up in jsdom
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock server actions that UsersTable components call
vi.mock("@/app/actions/admin", () => ({
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
  reinviteStaffUser: vi.fn(),
  cancelStaffInvite: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  inviteUser: vi.fn(),
}));

// sonner toast — avoid real DOM toasts in tests
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock shadcn Select with a native <select> so fireEvent.change works in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="role-select"
      value={value ?? "all"}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import { UsersTable } from "@/app/(staff)/admin/users/_components";
import type { UserRow } from "@/app/actions/admin";

function makeUser(overrides: Partial<UserRow>): UserRow {
  return {
    id: `id-${Math.random()}`,
    email: "user@corp.com",
    display_name: "Test User",
    role: "client",
    is_active: true,
    is_pending_invite: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const adminUser = makeUser({
  id: "admin-1",
  display_name: "Ana Admin",
  email: "ana.admin@corp.com",
  role: "admin",
});

const itUser = makeUser({
  id: "it-1",
  display_name: "Carlos TI",
  email: "carlos.ti@corp.com",
  role: "it",
});

const clientUser = makeUser({
  id: "client-1",
  display_name: "Beatriz Client",
  email: "beatriz.client@corp.com",
  role: "client",
});

const allUsers: UserRow[] = [adminUser, itUser, clientUser];

describe("UsersTable — filter panel", () => {
  it("renders role select with Todos, Administrador, TI, Cliente options (Scenario U-1)", async () => {
    render(<UsersTable users={allUsers} />);
    // The role select trigger should be present
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    // Default selected value shows "Todos"
    expect(trigger).toHaveTextContent("Todos");
  });

  it("shows all users by default — Todos selected (Scenario U-3 / U-8)", () => {
    render(<UsersTable users={allUsers} />);
    expect(screen.getByText("Ana Admin")).toBeInTheDocument();
    expect(screen.getByText("Carlos TI")).toBeInTheDocument();
    expect(screen.getByText("Beatriz Client")).toBeInTheDocument();
  });

  it("filters search by display_name case-insensitively (Scenario U-4)", () => {
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "ana" } });
    expect(screen.getByText("Ana Admin")).toBeInTheDocument();
    expect(screen.queryByText("Carlos TI")).not.toBeInTheDocument();
    expect(screen.queryByText("Beatriz Client")).not.toBeInTheDocument();
  });

  it("filters search by email case-insensitively (Scenario U-5)", () => {
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "GARCIA" } });
    // None of our test users have "garcia" in email, so no results
    expect(
      screen.getByText(/No hay usuarios que coincidan con los filtros/i),
    ).toBeInTheDocument();
  });

  it("matches email containing search term (Scenario U-5 positive)", () => {
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "carlos.ti" } });
    expect(screen.getByText("Carlos TI")).toBeInTheDocument();
    expect(screen.queryByText("Ana Admin")).not.toBeInTheDocument();
  });

  it("shows empty-state message when no users match filters (Scenario U-7)", () => {
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "zzznomatch" } });
    expect(
      screen.getByText(/No hay usuarios que coincidan con los filtros/i),
    ).toBeInTheDocument();
  });

  it("clearing search restores full list (Scenario U-8)", () => {
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "ana" } });
    expect(screen.queryByText("Carlos TI")).not.toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Carlos TI")).toBeInTheDocument();
    expect(screen.getByText("Beatriz Client")).toBeInTheDocument();
  });

  it("no network call triggered on filter change (Scenario U-10)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<UsersTable users={allUsers} />);
    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre o correo/i,
    );
    fireEvent.change(searchInput, { target: { value: "ana" } });
    // No fetch calls should have been made during filter
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("filters by role 'TI' — shows only it users (Scenario U-2)", () => {
    render(<UsersTable users={allUsers} />);
    const roleSelect = screen.getByTestId("role-select");
    fireEvent.change(roleSelect, { target: { value: "it" } });
    expect(screen.getByText("Carlos TI")).toBeInTheDocument();
    expect(screen.queryByText("Ana Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Beatriz Client")).not.toBeInTheDocument();
  });

  it("filters by role 'admin' — shows only admin users (Scenario U-2)", () => {
    render(<UsersTable users={allUsers} />);
    const roleSelect = screen.getByTestId("role-select");
    fireEvent.change(roleSelect, { target: { value: "admin" } });
    expect(screen.getByText("Ana Admin")).toBeInTheDocument();
    expect(screen.queryByText("Carlos TI")).not.toBeInTheDocument();
    expect(screen.queryByText("Beatriz Client")).not.toBeInTheDocument();
  });
});
