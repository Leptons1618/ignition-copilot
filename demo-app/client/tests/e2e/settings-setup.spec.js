import { test, expect } from '@playwright/test';

const baseConfig = {
  llmProvider: 'none',
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: '',
  ollamaUrl: '',
  ignitionUrl: 'http://localhost:8088',
  ignitionProject: 'ignition-copilot',
  ignitionUser: 'admin',
  ignitionPass: '********',
};

const baseChecklist = {
  ignitionScriptsInstalled: false,
  mcpConfigured: false,
};

test.beforeEach(async ({ page }) => {
  const checklistState = { ...baseChecklist };

  await page.route('**/api/config/services', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(baseConfig) });
      return;
    }
    const payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  await page.route('**/api/config/setup/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'none',
        steps: {
          llmSelected: false,
          llmConfigured: false,
          llmVerified: false,
          ignitionScriptsInstalled: checklistState.ignitionScriptsInstalled,
          ignitionVerified: false,
          mcpConfigured: checklistState.mcpConfigured,
        },
        checklist: checklistState,
      }),
    });
  });

  await page.route('**/api/config/setup/checklist', async (route) => {
    const payload = route.request().postDataJSON();
    Object.assign(checklistState, payload?.checklist || {});
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.route('**/api/config/setup/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        llm: { connected: true, status: 200 },
        ignition: { connected: true, status: 200 },
      }),
    });
  });

  await page.route('**/api/config/services/test', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        llm: { connected: true, status: 200 },
        ignition: { connected: true, status: 200 },
      }),
    });
  });

  await page.route('**/api/ignition/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true }) });
  });
});

async function openSettingsTab(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await expect(page.getByText('System Configuration')).toBeVisible();
}

test('defaults to not configured provider and saves API setup', async ({ page }) => {
  await openSettingsTab(page);

  await expect(page.getByTestId('settings-llm-provider')).toHaveValue('none');

  await page.getByTestId('settings-llm-provider').selectOption('openai');
  await page.getByTestId('settings-llm-base-url').fill('https://api.openai.com');
  await page.getByTestId('settings-llm-model').fill('gpt-4o-mini');
  await page.getByTestId('settings-llm-api-key').fill('test-key-123');

  await page.getByTestId('settings-save').click();
});

test('local setup flow supports manual checklist and verification', async ({ page }) => {
  await openSettingsTab(page);

  await page.getByTestId('settings-llm-provider').selectOption('ollama');
  await page.getByTestId('settings-llm-base-url').fill('http://localhost:11434');
  await page.getByTestId('settings-llm-model').fill('llama3.2:3b');

  await page.getByTestId('settings-manual-ignitionScriptsInstalled').check();
  await page.getByTestId('settings-manual-mcpConfigured').check();

  await page.getByTestId('settings-verify-setup').click();
  await expect(page.getByText('Verification Results')).toBeVisible();
});
