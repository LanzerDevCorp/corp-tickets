import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button smoke test", () => {
  it("renders with text content", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Click me");
  });

  it("renders with custom variant", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: /delete/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Delete");
  });
});
