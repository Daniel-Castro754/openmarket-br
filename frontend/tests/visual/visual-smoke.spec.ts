import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Mode = "light" | "dark";
type Navigation = "topbar" | "sidebar" | "rail";
type ColorTheme = "openmarket" | "ocean" | "terminal";

type VisualCase = {
  name: string;
  path: string;
  mode: Mode;
  navigation: Navigation;
  colorTheme?: ColorTheme;
  viewport: { width: number; height: number };
  requiresData?: boolean;
};

const ticker = process.env.QA_ASSET_TICKER ?? "PETR4";
const requireData = process.env.QA_REQUIRE_DATA === "1";
const desktop = { width: 1440, height: 1000 };
const notebook = { width: 1180, height: 860 };
const mobile = { width: 390, height: 844 };

const visualMatrix: VisualCase[] = [
  {
    name: "home · light · topbar · desktop",
    path: "/",
    mode: "light",
    navigation: "topbar",
    viewport: desktop,
  },
  {
    name: "home · dark · sidebar · desktop",
    path: "/",
    mode: "dark",
    navigation: "sidebar",
    viewport: desktop,
  },
  {
    name: "home · ocean · rail · notebook",
    path: "/",
    mode: "dark",
    navigation: "rail",
    colorTheme: "ocean",
    viewport: notebook,
  },
  {
    name: "empresa · light · sidebar · desktop",
    path: `/ativos/${ticker}`,
    mode: "light",
    navigation: "sidebar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "indicadores · light · topbar · desktop",
    path: `/ativos/${ticker}/indicadores`,
    mode: "light",
    navigation: "topbar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "indicadores · dark · rail · notebook",
    path: `/ativos/${ticker}/indicadores`,
    mode: "dark",
    navigation: "rail",
    viewport: notebook,
    requiresData: true,
  },
  {
    name: "financeiro · dark · topbar · desktop",
    path: `/ativos/${ticker}/financeiro`,
    mode: "dark",
    navigation: "topbar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "desempenho e risco · dark · topbar · desktop",
    path: `/ativos/${ticker}/desempenho`,
    mode: "dark",
    navigation: "topbar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "comparador · light · topbar · desktop",
    path: "/comparar",
    mode: "light",
    navigation: "topbar",
    viewport: desktop,
  },
  {
    name: "screener · dark · topbar · desktop",
    path: "/screener",
    mode: "dark",
    navigation: "topbar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "relatorios · light · topbar · desktop",
    path: "/relatorios",
    mode: "light",
    navigation: "topbar",
    viewport: desktop,
    requiresData: true,
  },
  {
    name: "home · light · mobile",
    path: "/",
    mode: "light",
    navigation: "topbar",
    viewport: mobile,
  },
  {
    name: "indicadores · dark · mobile",
    path: `/ativos/${ticker}/indicadores`,
    mode: "dark",
    navigation: "topbar",
    viewport: mobile,
    requiresData: true,
  },
  {
    name: "comparador · light · mobile",
    path: "/comparar",
    mode: "light",
    navigation: "topbar",
    viewport: mobile,
  },
  {
    name: "relatorios · dark · mobile",
    path: "/relatorios",
    mode: "dark",
    navigation: "topbar",
    viewport: mobile,
    requiresData: true,
  },
];

if (!process.env.QA_BASE_URL || process.env.QA_INCLUDE_DEV === "1") {
  visualMatrix.push({
    name: "design system · light · desktop",
    path: "/dev/design-system",
    mode: "light",
    navigation: "topbar",
    viewport: desktop,
  });
}

async function seedAppearance(
  page: Page,
  mode: Mode,
  navigation: Navigation,
  colorTheme: ColorTheme = "openmarket",
) {
  await page.addInitScript(
    ({ storedMode, storedNavigation, storedColorTheme }) => {
      localStorage.setItem("openmarket-mode", storedMode);
      localStorage.setItem("openmarket-nav-position", storedNavigation);
      localStorage.setItem("openmarket-color-theme", storedColorTheme);
    },
    {
      storedMode: mode,
      storedNavigation: navigation,
      storedColorTheme: colorTheme,
    },
  );
}

async function openCase(page: Page, visualCase: VisualCase) {
  await page.setViewportSize(visualCase.viewport);
  await seedAppearance(
    page,
    visualCase.mode,
    visualCase.navigation,
    visualCase.colorTheme ?? "openmarket",
  );

  const response = await page.goto(visualCase.path, { waitUntil: "domcontentloaded" });
  expect(response, `Sem resposta HTTP para ${visualCase.path}`).not.toBeNull();

  const status = response?.status() ?? 0;
  if (visualCase.requiresData && status >= 400 && !requireData) {
    test.skip(true, `${visualCase.path} depende de backend/dados locais disponíveis; status ${status}.`);
  }

  expect(status, `Status inesperado em ${visualCase.path}`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
  await expect(page.locator("body")).toBeVisible();
}

async function assertShellIntegrity(page: Page, visualCase: VisualCase) {
  const state = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    navigation: document.documentElement.dataset.navigation,
    colorTheme: document.documentElement.dataset.colorTheme,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    bodyText: document.body.innerText,
  }));

  expect(state.mode).toBe(visualCase.mode);
  expect(state.navigation).toBe(visualCase.navigation);
  expect(state.colorTheme).toBe(visualCase.colorTheme ?? "openmarket");
  expect(state.scrollWidth, "A página inteira não deve produzir overflow horizontal.").toBeLessThanOrEqual(
    state.clientWidth + 2,
  );
  expect(state.bodyText).not.toContain("NaN");
}

async function attachFullPage(page: Page, testInfo: TestInfo, label: string) {
  const screenshot = await page.screenshot({
    fullPage: true,
    animations: "disabled",
  });

  await testInfo.attach(label, {
    body: screenshot,
    contentType: "image/png",
  });
}

test.describe("OpenMarket BR · visual smoke matrix", () => {
  for (const visualCase of visualMatrix) {
    test(visualCase.name, async ({ page }, testInfo) => {
      await openCase(page, visualCase);
      await assertShellIntegrity(page, visualCase);
      await attachFullPage(page, testInfo, visualCase.name);
    });
  }
});

test.describe("OpenMarket BR · print preview", () => {
  const printCases: VisualCase[] = [
    {
      name: "print · empresa",
      path: `/ativos/${ticker}`,
      mode: "light",
      navigation: "topbar",
      viewport: desktop,
      requiresData: true,
    },
    {
      name: "print · indicadores",
      path: `/ativos/${ticker}/indicadores`,
      mode: "light",
      navigation: "topbar",
      viewport: desktop,
      requiresData: true,
    },
    {
      name: "print · financeiro",
      path: `/ativos/${ticker}/financeiro`,
      mode: "light",
      navigation: "topbar",
      viewport: desktop,
      requiresData: true,
    },
    {
      name: "print · relatorios",
      path: "/relatorios",
      mode: "light",
      navigation: "topbar",
      viewport: desktop,
      requiresData: true,
    },
  ];

  for (const printCase of printCases) {
    test(printCase.name, async ({ page }, testInfo) => {
      await openCase(page, printCase);
      await page.emulateMedia({ media: "print" });

      const header = page.locator(".site-header");
      if ((await header.count()) > 0) {
        await expect(header).toBeHidden();
      }

      await attachFullPage(page, testInfo, printCase.name);
    });
  }
});
