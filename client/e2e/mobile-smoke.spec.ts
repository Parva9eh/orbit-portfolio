import { test, expect } from "@playwright/test";

/**
 * Smoke at 390×844 — mission chrome, step nav, Live tools collapsed by default.
 */
test.describe("Mission Control mobile (390×844)", () => {
  test("shell loads with brand, all steps, and Live default", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("ORBIT", { exact: false }).first()).toBeVisible();
    const steps = page.getByRole("navigation", { name: "Mission sections" });
    await expect(steps).toBeVisible();
    // All four step numbers fully visible (not clipped under Story/Live)
    for (const n of ["01", "02", "03", "04"]) {
      await expect(steps.getByRole("button", { name: n, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("group", { name: "View mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show NEO tools" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("mission steps are clickable on mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "02", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Constellation" })
    ).toBeVisible({ timeout: 10_000 });
    // NEO tools chips only on Live (03)
    await expect(page.getByRole("button", { name: "Show NEO tools" })).toHaveCount(0);
    await page.getByRole("button", { name: "04", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Transmission" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Live mode: NEO tools collapsed until Show is tapped", async ({
    page,
  }) => {
    await page.goto("/?mode=live");
    await page.getByRole("button", { name: "03", exact: true }).click();

    const showTools = page.getByRole("button", { name: "Show NEO tools" });
    await expect(showTools).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toHaveCount(0);

    await showTools.click();
    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Hide NEO tools" }).click();
    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toHaveCount(0);
  });

  test("NEO tools and Viz are mutually exclusive on mobile", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "03", exact: true }).click();

    const showTools = page.getByRole("button", { name: "Show NEO tools" });
    const showViz = page.getByRole("button", { name: "Viz", exact: true });
    await expect(showTools).toBeVisible({ timeout: 15_000 });
    await expect(showViz).toBeVisible();

    await showTools.click();
    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("toolbar", { name: "Visualization controls" })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Viz", exact: true }).click();
    await expect(
      page.getByRole("toolbar", { name: "Visualization controls" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Show NEO tools" }).click();
    await expect(
      page.getByRole("complementary", { name: "Live NEO tools" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("toolbar", { name: "Visualization controls" })
    ).toHaveCount(0);
  });
});
