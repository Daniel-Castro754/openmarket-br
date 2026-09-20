import { expect, test } from "@playwright/test";

type DocumentSummary = {
  id: string;
  title: string;
  source_url?: string | null;
  content_type: string;
  page_count?: number | null;
  processing_status: string;
};

type DocumentDetail = DocumentSummary & {
  sections: Array<{
    id: string;
    sequence: number;
    heading?: string | null;
    text: string;
    page_start?: number | null;
  }>;
};

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";
const apiBase = process.env.OPENMARKET_API_URL ?? "http://localhost:8000";

test.describe("OpenMarket BR · report viewer data-backed behavior", () => {
  test("opens processed CVM text and preserves page deep links", async ({
    page,
    request,
  }) => {
    test.skip(!requireData, "Este cenário exige backend e documentos oficiais sincronizados.");

    const listResponse = await request.get(
      `${apiBase}/api/v1/documents?ticker=${encodeURIComponent(ticker)}&limit=50`,
    );
    expect(listResponse.ok()).toBeTruthy();

    const documents = (await listResponse.json()) as DocumentSummary[];
    const document = documents.find(
      (item) =>
        item.source_url
        && item.processing_status === "ready"
        && item.content_type.toLowerCase().includes("pdf"),
    );

    expect(
      document,
      "O ticker sincronizado precisa ter um PDF oficial processado.",
    ).toBeTruthy();

    const detailResponse = await request.get(
      `${apiBase}/api/v1/documents/${encodeURIComponent(document!.id)}`,
    );
    expect(detailResponse.ok()).toBeTruthy();
    const detail = (await detailResponse.json()) as DocumentDetail;
    expect(detail.source_url).toBe(document!.source_url);
    expect(detail.processing_status).toBe("ready");
    expect(detail.sections.length).toBeGreaterThan(0);

    const searchable = detail.sections.find(
      (section) => section.text.trim().length >= 2 && section.page_start != null,
    );
    expect(
      searchable,
      "O PDF processado precisa ter uma seção textual associada a uma página.",
    ).toBeTruthy();

    const targetPage = searchable!.page_start!;
    const viewerResponse = await page.goto(
      `/relatorios/${document!.id}?page=${targetPage}#sec-${searchable!.sequence}`,
      { waitUntil: "domcontentloaded" },
    );
    expect(viewerResponse).not.toBeNull();
    expect(viewerResponse?.status() ?? 0).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Documento oficial" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir original na CVM/ })).toHaveAttribute(
      "href",
      document!.source_url!,
    );
    await expect(page.getByText(new RegExp(`Página ${targetPage}(?: de \\d+)?`)).first()).toBeVisible();
    await expect(page.locator('iframe[title^="Documento oficial:"]')).toHaveAttribute(
      "src",
      new RegExp(`#page=${targetPage}$`),
    );

    const term = searchable!.text
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
      .find((word) => word.length >= 2);

    expect(term, "A seção extraída precisa ter um termo pesquisável.").toBeTruthy();
    await page.getByLabel("Buscar no texto").fill(term!);
    await expect(page.getByText(/seç(?:ão|ões) encontrada/).first()).toBeVisible();
    await expect(page.locator(`#sec-${searchable!.sequence}`)).toBeVisible();
  });
});
