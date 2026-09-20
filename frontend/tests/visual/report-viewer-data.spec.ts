import { expect, test } from "@playwright/test";

type DocumentSummary = {
  id: string;
  title: string;
  source_url?: string | null;
  content_type: string;
};

type DocumentDetail = DocumentSummary & {
  sections: Array<{
    heading?: string | null;
    text: string;
    page_start?: number | null;
  }>;
};

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";
const apiBase = process.env.OPENMARKET_API_URL ?? "http://localhost:8000";

test.describe("OpenMarket BR · report viewer data-backed behavior", () => {
  test("opens an official synchronized document and preserves page deep links", async ({
    page,
    request,
  }) => {
    test.skip(!requireData, "Este cenário exige backend e documentos oficiais sincronizados.");

    const listResponse = await request.get(
      `${apiBase}/api/v1/documents?ticker=${encodeURIComponent(ticker)}&limit=50`,
    );
    expect(listResponse.ok()).toBeTruthy();

    const documents = (await listResponse.json()) as DocumentSummary[];
    const document =
      documents.find((item) => item.source_url && item.content_type.toLowerCase().includes("pdf"))
      ?? documents.find((item) => item.source_url);

    expect(document, "O ticker sincronizado precisa ter um documento com fonte oficial.").toBeTruthy();

    const detailResponse = await request.get(
      `${apiBase}/api/v1/documents/${encodeURIComponent(document!.id)}`,
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = (await detailResponse.json()) as DocumentDetail;
    expect(detail.source_url).toBe(document!.source_url);

    const viewerResponse = await page.goto(`/relatorios/${document!.id}?page=2`, {
      waitUntil: "domcontentloaded",
    });
    expect(viewerResponse).not.toBeNull();
    expect(viewerResponse?.status() ?? 0).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Documento oficial" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir original na CVM/ })).toHaveAttribute(
      "href",
      document!.source_url!,
    );

    if (document!.content_type.toLowerCase().includes("pdf")) {
      await expect(page.getByText(/Página 2(?: de \d+)?/).first()).toBeVisible();
      await expect(page.locator('iframe[title^="Documento oficial:"]')).toHaveAttribute(
        "src",
        /#page=2$/,
      );
    }

    if (detail.sections.length > 0) {
      const searchable = detail.sections.find((section) => section.text.trim().length >= 2);
      if (searchable) {
        const term = searchable.text.trim().split(/\s+/).find((word) => word.length >= 2);
        if (term) {
          await page.getByLabel("Buscar no texto").fill(term);
          await expect(page.getByText(/seç(?:ão|ões) encontrada/).first()).toBeVisible();
        }
      }
    }
  });
});
