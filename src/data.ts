import type { AppState } from './types'
import { createMaterialFromText } from './lib/recallEngine'

const sampleText = `
# 产品定位
刷记 RecallDrill 的目标不是把资料整理成复杂知识库，而是把资料转化成可反复检测的记忆任务。用户上传资料后，系统需要提炼知识点、生成题目，并在刷题过程中记录掌握情况。

# 可信题目
每一道题必须追溯到原始资料。题目、答案、解析都不能脱离资料乱编。用户答错后，需要看到正确答案、错误原因和原文依据。

# 复习循环
答错、不熟或跳过的题目会进入错题本。系统应优先让薄弱知识点和最近答错的题再次出现，帮助用户通过反复测试记住知识点。

# MVP 范围
第一版只需要支持上传一份资料、提取知识点、生成题目、刷题、错题本、重新练习错题和掌握度展示。不要做社区、复杂文件夹、笔记编辑器或完整知识库。
`

export const createInitialState = (): AppState => {
  const material = createMaterialFromText({
    title: 'RecallDrill 产品说明样例',
    kind: 'markdown',
    rawText: sampleText,
    depth: 'standard',
  })

  return {
    materials: [material],
    attempts: [],
    activeMaterialId: material.id,
  }
}
