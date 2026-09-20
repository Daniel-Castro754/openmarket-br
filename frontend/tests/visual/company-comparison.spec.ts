import { expect, test } from "@playwright/test";

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";

test.describe("OpenMarket BR · company comparison data-backed behavior", () => {
  test("uses registry semantics, reproducible URL and explicit availability states", async ({
    page,
  }, testInfo) => {
    test.skip(!requireData, "Este cenário exige backend e dados oficiais sincronizados.");

    const params = new URLSearchParams();
    params.set("tickers", `${ticker},ZZZZ3`);
    params.set("view", "all");
    params.set("frequency", "annual");
    for (const metric of ["revenue", "net-margin", "roa"]) {
      params.append("metrics", metric);
    }

    const response = await page.goto(`/comparar?${params.toString()}`, {
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Comparar empresas" })).toBeVisible();
    await expect(page.getByText("Receita", { exact: true })).toBeVisible();
    await expect(page.getByText("Margem Líquida", { exact: true })).toBeVisible();
    await expect(page.getByText("ROA", { exact: true })).toBeVisible();
    await expect(page.getByText("metodologia v1.0", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sincronização necessária", { exact: true }).first()).toBeVisible();

    const netMarginRow = page.locator("tbody tr").filter({ hasText: "Margem Líquida" }).first();
    const passportLink = netMarginRow.getByRole("link").first();
    await expect(passportLink).toHaveAttribute(
      "href",
      new RegExp(`/ativos/${ticker}/indicadores\\?passport=net-margin#data-passport$`),
    );

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get("tickers")).toBe(`${ticker},ZZZZ3`);
    expect(currentUrl.searchParams.get("frequency")).toBe("annual");
    expect(currentUrl.searchParams.getAll("metrics")).toEqual(["revenue", "net-margin", "roa"]);

    await page.getByLabel("Frequência").selectOption("quarterly");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.waitForURL((url) => url.searchParams.get("frequency") === "quarterly");

    const roaRow = page.locator("tbody tr").filter({ hasText: "ROA" }).first();
    await expect(roaRow).toContainText("Não suportado em trimestral");
    await expect(page.locator("body")).not.toContainText("NaN");

    await testInfo.attach("company-comparison-v2", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });
});
