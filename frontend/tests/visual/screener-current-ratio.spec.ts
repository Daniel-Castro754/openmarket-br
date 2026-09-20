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
    const valueInput = page.getByLabel("Valor para Liquidez Corrente");
    await expect(valueInput).toBeVisible();
    await valueInput.fill("0");

    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL((url) =>
      url.searchParams.getAll("filter").includes("current_ratio:gte:0"),
    );

    const row = page.locator("tbody tr").filter({ hasText: ticker }).first();
    await expect(row).toBeVisible();

    const headers = await page.locator("thead th").allTextContents();
    const currentRatioColumn = headers.findIndex((label) => label.includes("Liquidez Corrente"));
    expect(currentRatioColumn).toBeGreaterThanOrEqual(0);

    const currentRatioCell = row.locator("td").nth(currentRatioColumn);
    await expect(currentRatioCell).not.toHaveText("—");
    await expect(currentRatioCell).toContainText("x");

    const passportLink = currentRatioCell.getByRole("link");
    await expect(passportLink).toHaveAttribute(
      "href",
      new RegExp(`/ativos/${ticker}/indicadores\\?passport=current-ratio#data-passportimport { expect, test } from "@playwright/test";

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
    const valueInput = page.getByLabel("Valor para Liquidez Corrente");
    await expect(valueInput).toBeVisible();
    await valueInput.fill("0");

    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await page.waitForURL((url) =>
      url.searchParams.getAll("filter").includes("current_ratio:gte:0"),
    );

    const row = page.locator("tbody tr").filter({ hasText: ticker }).first();
    await expect(row).toBeVisible();

    const headers = await page.locator("thead th").allTextContents();
    const currentRatioColumn = headers.findIndex((label) => label.includes("Liquidez Corrente"));
    expect(currentRatioColumn).toBeGreaterThanOrEqual(0);

),
    );

    await page.getByRole("button", { name: /Liquidez Corrente/ }).click();
    await page.waitForURL((url) =>
      url.searchParams.get("sort") === "current_ratio"
      && url.searchParams.get("direction") === "desc"
      && url.searchParams.getAll("filter").includes("current_ratio:gte:0"),
    );

    await expect(page.locator("tbody tr").filter({ hasText: ticker }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");

    const sortedRow = page.locator("tbody tr").filter({ hasText: ticker }).first();
    const sortedHeaders = await page.locator("thead th").allTextContents();
    const sortedCurrentRatioColumn = sortedHeaders.findIndex((label) => label.includes("Liquidez Corrente"));
    const sortedPassportLink = sortedRow.locator("td").nth(sortedCurrentRatioColumn).getByRole("link");
    await sortedPassportLink.click();

    await page.waitForURL((url) =>
      url.pathname === `/ativos/${ticker}/indicadores`
      && url.searchParams.get("passport") === "current-ratio",
    );
    await expect(page.getByRole("heading", { name: `Liquidez Corrente · ${ticker}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dados usados no cálculo" })).toBeVisible();
    await expect(page.getByText("current_assets / current_liabilities", { exact: true })).toBeVisible();
    await expect(page.getByText("Ativo Circulante", { exact: true })).toBeVisible();
    await expect(page.getByText("Passivo Circulante", { exact: true })).toBeVisible();
    await expect(page.getByText("Data de referência", { exact: true })).toBeVisible();
    await expect(page.getByText("Coletado em", { exact: true })).toBeVisible();

    await testInfo.attach("indicator-data-passport", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });

    await testInfo.attach("screener-current-ratio", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
});
