import { test, expect } from "@playwright/test";

/**
 * Smoke at 390×844 — mission chrome, step nav, Live tools collapsed by default.
 */
test.describe("Mission Control mobile (390×844)", () => {
  test("shell loads with brand, steps, and story mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ORBIT", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mission sections" })).toBeVisible();
    // Compact step labels on phone
    await expect(
      page.getByRole("button", { name: "01", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "View mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Story" })).toBeVisible();
  });

  test("mission steps are clickable on mobile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "02", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Constellation" })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "04", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Transmission" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Live mode: NEO tools collapsed until Show is tapped", async ({
    page,
  }) => {
    await page.goto("/?mode=live");
    // Force live via top bar as well
    await page.getByRole("button", { name: "Live", exact: true }).click();

    const showTools = page.getByRole("button", { name: "Show NEO tools" });
    await expect(showTools).toBeVisible({ timeout: 15_000 });

    // Tools panel should not claim full chrome until opened
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

  test("viz toggle works on mobile", async ({ page }) => {
    await page.goto("/");
    const showViz = page.getByRole("button", { name: "Viz", exact: true });
    // Viz starts collapsed on phone → button label "Viz"
    if (await showViz.isVisible().catch(() => false)) {
      await showViz.click();
    }
    await expect(
      page.getByRole("toolbar", { name: "Visualization controls" })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Hide viz" }).click();
    await expect(
      page.getByRole("toolbar", { name: "Visualization controls" })
    ).toHaveCount(0);
  });
});
