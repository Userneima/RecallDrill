import { chromium } from 'playwright'

const baseUrl = process.env.RECALLDRILL_URL ?? 'http://127.0.0.1:5173/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []

page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await expectText(page, '刷记')
await expectText(page, '生成知识点和题目')
await page.screenshot({ path: 'tmp/recalldrill-desktop.png', fullPage: true })

await page.getByRole('button', { name: '开始刷题' }).click()
await expectText(page, '单选题')

const options = page.locator('.option')
if ((await options.count()) === 0) {
  throw new Error('No answer options rendered')
}
await options.first().click()
await page.getByRole('button', { name: '提交' }).click()
await expectText(page, '正确答案')
await expectText(page, '原文依据')

await page.getByRole('button', { name: '错题', exact: true }).click()
await expectText(page, '重新练错题')

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await expectText(page, '资料转题')
await page.screenshot({ path: 'tmp/recalldrill-mobile.png', fullPage: true })

await browser.close()

if (errors.length > 0) {
  throw new Error(`Browser console errors:\n${errors.join('\n')}`)
}

console.log('RecallDrill smoke test passed')

async function expectText(targetPage, text) {
  const locator = targetPage.getByText(text, { exact: false })
  await locator.first().waitFor({ state: 'visible', timeout: 5000 })
}
