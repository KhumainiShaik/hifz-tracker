import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { AuthContext } from "../../src/contexts/state";
vi.mock("../../src/components/Layout", () => ({ Layout: () => null }));
import { OwnerOnly } from "../../src/App";
describe("owner-only route enforcement", () => {
  it("redirects a viewer who directly opens Settings", () => {
    render(
      <AuthContext.Provider value={{ role: "viewer", user: null, error: "" }}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/" element={<p>Read-only dashboard</p>} />
            <Route
              path="/settings"
              element={
                <OwnerOnly>
                  <p>Private settings</p>
                </OwnerOnly>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("Read-only dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Private settings")).not.toBeInTheDocument();
  });
  it("allows the configured owner to reach protected screens", () => {
    render(
      <AuthContext.Provider value={{ role: "owner", user: null, error: "" }}>
        <MemoryRouter>
          <OwnerOnly>
            <p>Manage viewers</p>
          </OwnerOnly>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("Manage viewers")).toBeInTheDocument();
  });
});
