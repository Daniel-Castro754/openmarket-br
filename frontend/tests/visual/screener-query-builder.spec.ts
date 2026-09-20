import { expect, test } from "@playwright/test";

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";

test.describe("OpenMarket BR · Screener Query Builder", () => {
  test("restores OR logic, filters, sort, search and columns from URL", async ({ page }, testInfo) => {
    test.skip(!requireData, "Este cenário exige backend e dados oficiais sincronizados.");

    const params = new URLSearchParams();
    params.set("q", ticker);
    params.append("filter", "current_ratio:gte:0");
    params.append("filter", "roe:gte:999999");
    params.set("logic", "or");
    params.set("sort", "current_ratio");
    params.set("direction", "desc");
    params.append("column", "current_ratio");
    params.append("column", "roe");
    params.append("column", "latest_period");

    const response = await page.goto(`/screener?${params.toString()}`, {
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Screener fundamentalista" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Qualquer condição" })).toHaveClass(/logicActive/);
    await expect(page.getByLabel("Empresa ou ticker")).toHaveValue(ticker);

    const indicatorSelects = page.getByLabel("Indicador");
    await expect(indicatorSelects).toHaveCount(2);
    await expect(indicatorSelects.nth(0)).toHaveValue("current_ratio");
    await expect(indicatorSelects.nth(1)).toHaveValue("roe");

    await expect(page.getByLabel("Valor para Liquidez Corrente")).toHaveValue("0");
    await expect(page.getByLabel("Valor para ROE")).toHaveValue("999999");
    await expect(page.getByLabel("Resumo da consulta")).toContainText("Basta uma ser verdadeira");

    const row = page.locator("tbody tr").filter({ hasText: ticker }).first();
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "Colunas" }).click();
    await expect(page.getByRole("checkbox", { name: "Liquidez Corrente" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "ROE" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Último período" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Ticker" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "Empresa" })).toBeDisabled();

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "Qualquer condição" })).toHaveClass(/logicActive/);
    await expect(page.getByLabel("Empresa ou ticker")).toHaveValue(ticker);
    await expect(page.locator("tbody tr").filter({ hasText: ticker }).first()).toBeVisible();

    const restoredUrl = new URL(page.url());
    expect(restoredUrl.searchParams.get("logic")).toBe("or");
    expect(restoredUrl.searchParams.get("sort")).toBe("current_ratio");
    expect(restoredUrl.searchParams.get("direction")).toBe("desc");
    expect(restoredUrl.searchParams.getAll("filter")).toEqual([
      "current_ratio:gte:0",
      "roe:gte:999999",
    ]);
    expect(restoredUrl.searchParams.getAll("column")).toEqual([
      "current_ratio",
      "roe",
      "latest_period",
    ]);

    await testInfo.attach("screener-query-builder", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
});
