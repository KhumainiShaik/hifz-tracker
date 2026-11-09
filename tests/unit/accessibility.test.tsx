import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Field } from "../../src/components/ui";
it("associates a concise select label and a separate accessible description", () => {
  render(
    <Field label="Surah" hint="Select a chapter.">
      <select defaultValue="1">
        <option value="1">Al-Faatiha</option>
        <option value="112">Al-Ikhlaas</option>
      </select>
    </Field>,
  );
  const control = screen.getByRole("combobox", { name: "Surah" });
  expect(control).toHaveAccessibleDescription("Select a chapter.");
  expect(screen.getByLabelText("Surah", { exact: true })).toBe(control);
});
it("gives independent controls unique label associations", () => {
  render(
    <>
      <Field label="First">
        <input />
      </Field>
      <Field label="Second">
        <textarea />
      </Field>
    </>,
  );
  expect(screen.getByLabelText("First").id).not.toBe(
    screen.getByLabelText("Second").id,
  );
});
