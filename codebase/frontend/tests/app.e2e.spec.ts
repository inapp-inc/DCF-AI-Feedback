import { expect, test } from "@playwright/test";

async function loginToPlatform(page: import("@playwright/test").Page, platform: "ifamilynet" | "admin") {
  await page.goto(`/login/${platform}`);
  await page.locator("input").nth(0).fill("admin_demo");
  await page.locator("input").nth(1).fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("platform selector then iFamilyNet login and workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Choose a platform to open:")).toBeVisible();
  await page.getByRole("heading", { name: "iFamilyNet Platform" }).click();
  await expect(page).toHaveURL(/\/login\/ifamilynet/);
  await page.locator("input").nth(0).fill("admin_demo");
  await page.locator("input").nth(1).fill("demo");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/ifamilynet/);
  await expect(page.getByText("Commonwealth of Massachusetts")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send Survey" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Send Survey" }).first().click();
  await expect(page.getByText("Survey sent").first()).toBeVisible();
});

test("partner portal and public survey page load", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByText("Survey List")).toBeVisible();
  await page.getByText("Mandated Reporters").click();
  await expect(page.getByRole("heading", { name: /Open surveys — Mandated Reporters/i })).toBeVisible();
});

test("public survey token route shows form or expiry message", async ({ page }) => {
  const loginRes = await page.request.post("http://127.0.0.1:8080/v1/auth/login", {
    data: { username: "admin_demo", password: "demo" },
  });
  const { username } = await loginRes.json();
  const inst = await page.request.post("http://127.0.0.1:8080/v1/forms/instances", {
    headers: { "x-demo-user": username, "Content-Type": "application/json" },
    data: { templateId: "tpl_vol_v1", userGroup: "volunteer", triggerRef: "e2e-token" },
  });
  const { surveyInstanceId } = await inst.json();
  const send = await page.request.post(`http://127.0.0.1:8080/v1/forms/instances/${surveyInstanceId}/send`, {
    headers: { "x-demo-user": username },
  });
  const { customLink } = await send.json();
  const token = String(customLink).split("/").pop();
  await page.goto(`/survey/${token}`);
  await expect(page.getByText("Secure single-use survey")).toBeVisible({ timeout: 15_000 });
});

test("platform selector then admin login and analytics console", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Feedback Analytics" }).click();
  await expect(page).toHaveURL(/\/login\/admin/);
  await loginToPlatform(page, "admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Feedback Analytics")).toBeVisible();
  await expect(page.getByRole("button", { name: "Queue" })).toBeVisible();
  await page.getByRole("button", { name: "Survey forms" }).click();
  await expect(page.getByText("Survey templates")).toBeVisible();
});

test("staff routes redirect to platform login when unauthenticated", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\/admin/);
  await page.goto("/ifamilynet");
  await expect(page).toHaveURL(/\/login\/ifamilynet/);
});
