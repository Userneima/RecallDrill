export type ViewId = 'materials' | 'drill' | 'wrong' | 'mastery'

export type MaterialKind = 'text' | 'markdown' | 'pdf' | 'subtitle' | 'note'

export type GenerationDepth = 'quick' | 'standard' | 'deep'

export type MasteryLevel = 'new' | 'weak' | 'familiar' | 'mastered'

export type QuestionType = 'single' | 'judge' | 'blank'

export interface SourceChunk {
  id: string
  topic: string
  text: string
  location: string
}

export interface KnowledgePoint {
  id: string
  materialId: string
  topic: string
  title: string
  summary: string
  importance: '高' | '中' | '低'
  difficulty: '基础' | '进阶' | '困难'
  sourceExcerpt: string
  sourceLocation: string
  mastery: MasteryLevel
  correctStreak: number
  attempts: number
  wrongCount: number
}

export interface Question {
  id: string
  materialId: string
  knowledgePointId: string
  type: QuestionType
  stem: string
  options?: string[]
  answer: string
  explanation: string
  sourceExcerpt: string
  sourceLocation: string
  attempts: number
  wrongCount: number
  lastAnsweredAt?: string
  markedUnfamiliar?: boolean
}

export interface Attempt {
  id: string
  materialId: string
  questionId: string
  knowledgePointId: string
  userAnswer: string
  correct: boolean
  createdAt: string
}

export interface Material {
  id: string
  title: string
  kind: MaterialKind
  createdAt: string
  updatedAt: string
  status: 'ready' | 'failed'
  rawText: string
  chunks: SourceChunk[]
  knowledgePoints: KnowledgePoint[]
  questions: Question[]
}

export interface AppState {
  materials: Material[]
  attempts: Attempt[]
  activeMaterialId?: string
}
