import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

const baseUrl = process.env.RECALLDRILL_URL ?? 'http://127.0.0.1:5173/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
const smokeDir = path.resolve('tmp/smoke')
const markdownPath = path.join(smokeDir, 'memory-loop.md')
const docxPath = path.join(smokeDir, 'source-evidence.docx')

page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await prepareSmokeFiles()

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await expectText(page, '刷记')
await expectText(page, '生成知识点和题目')
await page.locator('input[type="file"]').setInputFiles([markdownPath, docxPath])
await expectText(page, '已选择 2 个文档')
await page.screenshot({ path: 'tmp/recalldrill-desktop.png', fullPage: true })

await page.getByRole('button', { name: '生成知识点和题目' }).click()
await expectText(page, '单选题')
const storedMaterial = await page.evaluate(() => JSON.parse(localStorage.getItem('recalldrill.state.v1') ?? '{}').materials?.[0])
if (storedMaterial?.documents?.length !== 2) {
  throw new Error('Multi-document material was not persisted')
}
if (!storedMaterial.documents.some((document) => document.kind === 'docx')) {
  throw new Error('DOCX document was not parsed into the study set')
}
if (!storedMaterial.chunks.some((chunk) => String(chunk.location).includes('source-evidence.docx'))) {
  throw new Error('DOCX source location was not preserved')
}

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

async function prepareSmokeFiles() {
  await fs.mkdir(smokeDir, { recursive: true })
  await fs.writeFile(
    markdownPath,
    `# 记忆循环\n刷记的核心目标是把资料变成可以反复测试的记忆任务。系统应优先安排薄弱知识点和最近答错的题目，让用户通过重复检测形成稳定记忆。\n\n# 错题复习\n答错、不熟或跳过的题会进入错题本。错题再次出现时，用户必须看到正确答案、解析和原文依据。`,
  )
  await fs.writeFile(
    docxPath,
    await createDocxBuffer([
      'DOCX 文档支持',
      '多文档学习集允许用户一次选择多个资料文件，并把它们合并成同一个刷题范围。',
      '每个知识点仍然需要保留来源文档名称和段落位置，避免题目脱离资料。',
    ]),
  )
}

async function createDocxBuffer(paragraphs) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  zip.folder('word')?.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`).join('')}
  </w:body>
</w:document>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
