import { expect, test } from "@playwright/test";

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";

test.describe("OpenMarket BR · screener data-backed behavior", () => {
  test("filters, renders and sorts current ratio", async ({ page }, testInfo) => {
    test.skip(!requireData, "Este cenário exige backend e dados oficiais sincronizados.");

    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto("/screener", { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await page.getByLabel("Indicador").first().selectOption("current_ratio");
    const valueInput = page.getByLabel("Valor para Liquidez corrente");
    await expect(valueInput).toBeVisible();
    await valueInput.fill("0");

    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL((url) =>
      url.searchParams.getAll("filter").includes("current_ratio:gte:0"),
    );

    const row = page.locator("tbody tr").filter({ hasText: ticker }).first();
    await expect(row).toBeVisible();

    const headers = await page.locator("thead th").allTextContents();
    const currentRatioColumn = headers.findIndex((label) => label.includes("Liquidez corrente"));
    expect(currentRatioColumn).toBeGreaterThanOrEqual(0);

    const currentRatioCell = row.locator("td").nth(currentRatioColumn);
    await expect(currentRatioCell).not.toHaveText("—");
    await expect(currentRatioCell).toContainText("x");

    await page.getByRole("button", { name: /Liquidez corrente/ }).click();
    await page.waitForURL((url) =>
      url.searchParams.get("sort") === "current_ratio"
      && url.searchParams.get("direction") === "desc"
      && url.searchParams.getAll("filter").includes("current_ratio:gte:0"),
    );

    await expect(page.locator("tbody tr").filter({ hasText: ticker }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");

    await testInfo.attach("screener-current-ratio", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
});
