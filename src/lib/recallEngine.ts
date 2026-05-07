import type {
  Attempt,
  GenerationDepth,
  KnowledgePoint,
  MasteryLevel,
  Material,
  MaterialKind,
  Question,
  SourceChunk,
} from '../types'

const now = () => new Date().toISOString()

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

const clampText = (value: string, max = 112) => {
  const text = clean(value)
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const importantWords = [
  '核心',
  '必须',
  '关键',
  '目标',
  '原则',
  '定义',
  '流程',
  '优先',
  '需要',
  '风险',
  '不能',
  '依据',
]

const difficultWords = ['算法', '模型', '架构', '策略', '系统', '复杂', '规则', '自动', '追溯']

const genericDistractors = [
  '主要用于管理资料文件夹，与练习结果没有直接关系。',
  '重点是生成尽可能多的题目，数量优先于可靠性。',
  '用户答题后只需要看到分数，不需要查看原文依据。',
  '系统应把资料整理成完整知识库，而不是形成练习循环。',
]

export function inferKind(fileName: string): MaterialKind {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  if (lower.endsWith('.srt') || lower.endsWith('.vtt')) return 'subtitle'
  return 'text'
}

export function normalizeAnswer(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[。！？,.，；;:\s]/g, '')
}

export function createMaterialFromText(input: {
  title: string
  kind: MaterialKind
  rawText: string
  depth: GenerationDepth
}): Material {
  const materialId = uid('mat')
  const chunks = chunkMaterial(input.rawText)
  const knowledgePoints = extractKnowledgePoints(chunks, materialId)
  const questions = generateQuestions(knowledgePoints, input.depth)
  const time = now()

  return {
    id: materialId,
    title: input.title || '未命名资料',
    kind: input.kind,
    createdAt: time,
    updatedAt: time,
    status: 'ready',
    rawText: input.rawText,
    chunks,
    knowledgePoints,
    questions,
  }
}

function chunkMaterial(rawText: string): SourceChunk[] {
  const normalized = rawText
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return []

  const chunks: SourceChunk[] = []
  let currentTopic = '未分组'
  let buffer: string[] = []
  let paragraphIndex = 1

  const flush = () => {
    const text = clean(buffer.join('\n'))
    if (text.length < 24) {
      buffer = []
      return
    }

    chunks.push({
      id: uid('chunk'),
      topic: currentTopic,
      text,
      location: `第 ${paragraphIndex} 段`,
    })
    paragraphIndex += 1
    buffer = []
  }

  normalized.split('\n').forEach((line) => {
    const trimmed = line.trim()
    const heading = trimmed.match(/^(#{1,6}\s+|[一二三四五六七八九十]+[、.．]|[0-9]+[.、])(.{2,48})$/)

    if (heading) {
      flush()
      currentTopic = clean(heading[2])
      return
    }

    if (!trimmed) {
      flush()
      return
    }

    buffer.push(trimmed.replace(/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/, ''))
  })

  flush()

  if (chunks.length > 0) return chunks

  const fallback = normalized.match(/.{1,240}([。！？.!?]|$)/g) ?? [normalized]
  return fallback
    .map((text) => clean(text))
    .filter((text) => text.length >= 16)
    .map((text, index) => ({
      id: uid('chunk'),
      topic: '未分组',
      text,
      location: `第 ${index + 1} 段`,
    }))
}

function extractKnowledgePoints(chunks: SourceChunk[], materialId: string): KnowledgePoint[] {
  return chunks.slice(0, 36).map((chunk, index) => {
    const sentences = chunk.text.split(/(?<=[。！？.!?])\s*/).filter(Boolean)
    const firstSentence = clean(sentences[0] ?? chunk.text)
    const title = makeTitle(firstSentence, chunk.topic, index)
    const summary = clampText(firstSentence.length >= 18 ? firstSentence : chunk.text, 128)
    const importanceScore = importantWords.filter((word) => chunk.text.includes(word)).length
    const difficultyScore = difficultWords.filter((word) => chunk.text.includes(word)).length

    return {
      id: uid('kp'),
      materialId,
      topic: chunk.topic,
      title,
      summary,
      importance: importanceScore >= 2 || index < 2 ? '高' : importanceScore === 1 ? '中' : '低',
      difficulty: difficultyScore >= 3 ? '困难' : difficultyScore >= 1 ? '进阶' : '基础',
      sourceExcerpt: clampText(chunk.text, 220),
      sourceLocation: chunk.location,
      mastery: 'new',
      correctStreak: 0,
      attempts: 0,
      wrongCount: 0,
    }
  })
}

function makeTitle(sentence: string, topic: string, index: number) {
  const withoutMarkdown = sentence
    .replace(/[`*_>#-]/g, '')
    .replace(/^第?[一二三四五六七八九十0-9]+[章节部分、.．]\s*/, '')
  const title = clean(withoutMarkdown).slice(0, 26)
  if (title.length >= 8) return title
  return `${topic} 知识点 ${index + 1}`
}

function generateQuestions(points: KnowledgePoint[], depth: GenerationDepth): Question[] {
  const countByDepth = depth === 'quick' ? 1 : depth === 'standard' ? 2 : 3

  return points.flatMap((point, index) => {
    const questions = [createSingleChoice(point, points, index)]

    if (countByDepth >= 2) {
      questions.push(createJudgeQuestion(point, index))
    }

    if (countByDepth >= 3) {
      const blank = createBlankQuestion(point)
      if (blank) questions.push(blank)
    }

    return questions
  })
}

function createSingleChoice(point: KnowledgePoint, allPoints: KnowledgePoint[], index: number): Question {
  const nearby = allPoints
    .filter((item) => item.id !== point.id)
    .slice(index + 1, index + 3)
    .map((item) => item.summary)

  const options = deterministicShuffle(
    [point.summary, ...nearby, ...genericDistractors].slice(0, 4),
    index,
  )

  return {
    id: uid('q'),
    materialId: point.materialId,
    knowledgePointId: point.id,
    type: 'single',
    stem: `关于「${point.title}」，以下哪项最符合原文？`,
    options,
    answer: point.summary,
    explanation: `这道题检测你是否抓住了该知识点的核心表述。依据来自 ${point.sourceLocation}。`,
    sourceExcerpt: point.sourceExcerpt,
    sourceLocation: point.sourceLocation,
    attempts: 0,
    wrongCount: 0,
  }
}

function createJudgeQuestion(point: KnowledgePoint, index: number): Question {
  const isTrue = index % 3 !== 1
  const statement = isTrue
    ? `原文认为：${point.summary}`
    : `原文认为：${point.title} 的重点是脱离资料自由发挥，而不是依据原文练习。`

  return {
    id: uid('q'),
    materialId: point.materialId,
    knowledgePointId: point.id,
    type: 'judge',
    stem: `判断：${statement}`,
    options: ['正确', '错误'],
    answer: isTrue ? '正确' : '错误',
    explanation: isTrue
      ? `该判断复述了原资料中的关键表述。`
      : `该判断与原文依据相反；刷记要求题目、答案和解析都能回到原资料。`,
    sourceExcerpt: point.sourceExcerpt,
    sourceLocation: point.sourceLocation,
    attempts: 0,
    wrongCount: 0,
  }
}

function createBlankQuestion(point: KnowledgePoint): Question | null {
  const term = pickBlankTerm(point)
  if (!term || term.length < 2) return null
  const stem = `填空：${point.summary.replace(term, '____')}`

  return {
    id: uid('q'),
    materialId: point.materialId,
    knowledgePointId: point.id,
    type: 'blank',
    stem,
    answer: term,
    explanation: `空缺词来自知识点标题或原文关键短语，用来检查你是否记住了具体概念。`,
    sourceExcerpt: point.sourceExcerpt,
    sourceLocation: point.sourceLocation,
    attempts: 0,
    wrongCount: 0,
  }
}

function pickBlankTerm(point: KnowledgePoint) {
  const titleTerm = point.title.match(/[A-Za-z][A-Za-z0-9 -]{2,}|[\u4e00-\u9fa5]{2,8}/)?.[0]
  if (titleTerm && point.summary.includes(titleTerm)) return titleTerm
  return point.summary.match(/[A-Za-z][A-Za-z0-9 -]{2,}|[\u4e00-\u9fa5]{2,6}/)?.[0] ?? ''
}

function deterministicShuffle<T>(items: T[], seed: number) {
  return [...items].sort(() => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280 - 0.5
  })
}

export function evaluateAnswer(question: Question, userAnswer: string) {
  if (question.type === 'blank') {
    return normalizeAnswer(userAnswer).includes(normalizeAnswer(question.answer))
  }

  return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer)
}

export function updateKnowledgePoint(point: KnowledgePoint, correct: boolean, markedUnfamiliar = false): KnowledgePoint {
  const attempts = point.attempts + 1
  const wrongCount = correct && !markedUnfamiliar ? point.wrongCount : point.wrongCount + 1
  const correctStreak = correct && !markedUnfamiliar ? point.correctStreak + 1 : 0
  let mastery: MasteryLevel = 'weak'

  if (correctStreak >= 3 && wrongCount === 0) mastery = 'mastered'
  else if (correctStreak >= 2) mastery = 'familiar'
  else if (attempts === 0) mastery = 'new'

  return {
    ...point,
    attempts,
    wrongCount,
    correctStreak,
    mastery,
  }
}

export function createAttempt(input: {
  materialId: string
  questionId: string
  knowledgePointId: string
  userAnswer: string
  correct: boolean
}): Attempt {
  return {
    id: uid('attempt'),
    createdAt: now(),
    ...input,
  }
}

export function questionPriority(question: Question, point?: KnowledgePoint) {
  const weakBoost = point?.mastery === 'weak' ? 12 : point?.mastery === 'new' ? 7 : 0
  const wrongBoost = question.wrongCount * 10
  const unfamiliarBoost = question.markedUnfamiliar ? 8 : 0
  const freshnessPenalty = question.lastAnsweredAt ? 2 : 0
  return weakBoost + wrongBoost + unfamiliarBoost - freshnessPenalty
}
