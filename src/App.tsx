import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Archive,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  FileUp,
  Highlighter,
  Library,
  RotateCcw,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react'
import './App.css'
import { createInitialState } from './data'
import {
  createAttempt,
  createMaterialFromDocuments,
  evaluateAnswer,
  inferKind,
  questionPriority,
  updateKnowledgePoint,
} from './lib/recallEngine'
import type { AppState, GenerationDepth, Material, MaterialDocument, Question, ViewId } from './types'

const STORAGE_KEY = 'recalldrill.state.v1'

type ImportedDocument = Omit<MaterialDocument, 'id'> & { tempId: string }

const navItems: Array<{ id: ViewId; label: string; icon: typeof Library }> = [
  { id: 'materials', label: '资料', icon: Library },
  { id: 'drill', label: '刷题', icon: Target },
  { id: 'wrong', label: '错题', icon: Archive },
  { id: 'mastery', label: '掌握', icon: BarChart3 },
]

const masteryLabel = {
  new: '未练',
  weak: '薄弱',
  familiar: '熟悉',
  mastered: '掌握',
}

const masteryClass = {
  new: 'is-new',
  weak: 'is-weak',
  familiar: 'is-familiar',
  mastered: 'is-mastered',
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [view, setView] = useState<ViewId>('materials')
  const [draftTitle, setDraftTitle] = useState('我的学习资料')
  const [draftText, setDraftText] = useState('')
  const [depth, setDepth] = useState<GenerationDepth>('standard')
  const [importedDocuments, setImportedDocuments] = useState<ImportedDocument[]>([])
  const [uploadError, setUploadError] = useState('')
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const [sessionIndex, setSessionIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ question: Question; correct: boolean; userAnswer: string } | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeMaterial = useMemo(
    () => state.materials.find((item) => item.id === state.activeMaterialId) ?? state.materials[0],
    [state.activeMaterialId, state.materials],
  )

  const activeStats = useMemo(() => getMaterialStats(activeMaterial), [activeMaterial])

  const weakPoints = useMemo(
    () =>
      activeMaterial?.knowledgePoints
        .filter((point) => point.mastery === 'weak' || point.mastery === 'new')
        .sort((a, b) => b.wrongCount - a.wrongCount)
        .slice(0, 6) ?? [],
    [activeMaterial],
  )

  const activeQuestion = useMemo(() => {
    if (!activeMaterial) return undefined
    const selectedId = sessionIds[sessionIndex]
    return activeMaterial.questions.find((question) => question.id === selectedId) ?? pickNextQuestion(activeMaterial)
  }, [activeMaterial, sessionIds, sessionIndex])

  const wrongQuestions = useMemo(
    () =>
      activeMaterial?.questions
        .filter((question) => question.wrongCount > 0 || question.markedUnfamiliar)
        .sort((a, b) => {
          const pointA = activeMaterial.knowledgePoints.find((point) => point.id === a.knowledgePointId)
          const pointB = activeMaterial.knowledgePoints.find((point) => point.id === b.knowledgePointId)
          return questionPriority(b, pointB) - questionPriority(a, pointA)
        }) ?? [],
    [activeMaterial],
  )

  const createMaterial = () => {
    const pasteText = draftText.trim()
    const documents: ImportedDocument[] = [
      ...importedDocuments,
      ...(pasteText
        ? [
            {
              tempId: `paste-${Date.now()}`,
              title: '粘贴文本',
              kind: 'text' as const,
              rawText: pasteText,
            },
          ]
        : []),
    ]

    const totalLength = documents.reduce((sum, document) => sum + document.rawText.trim().length, 0)
    if (totalLength < 80) {
      setUploadError('资料内容太短，至少需要一小段可提取知识点的文本。')
      return
    }

    const title =
      draftTitle.trim() ||
      (documents.length > 1 ? `${documents.length} 个文档学习集` : documents[0]?.title.replace(/\.[^.]+$/, '')) ||
      '未命名资料'
    const material = createMaterialFromDocuments({
      title,
      documents: documents.map((document) => ({
        title: document.title,
        kind: document.kind,
        rawText: document.rawText,
      })),
      depth,
    })

    setState((current) => ({
      ...current,
      materials: [material, ...current.materials],
      activeMaterialId: material.id,
    }))
    setUploadError('')
    setDraftText('')
    setImportedDocuments([])
    setDraftTitle('我的学习资料')
    setSessionIds(material.questions.map((question) => question.id))
    setSessionIndex(0)
    setFeedback(null)
    setAnswer('')
    setView('drill')
  }

  const handleFiles = async (files?: FileList | File[]) => {
    const selectedFiles = Array.from(files ?? [])
    if (selectedFiles.length === 0) return
    setIsParsingFile(true)
    setUploadError('')

    try {
      const parsedDocuments = await Promise.all(selectedFiles.map(readDocumentFile))
      setImportedDocuments((current) => [...current, ...parsedDocuments])
      setDraftTitle((current) => {
        if (current !== '我的学习资料') return current
        if (parsedDocuments.length === 1) return parsedDocuments[0].title.replace(/\.[^.]+$/, '')
        return `${parsedDocuments.length} 个文档学习集`
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '文件解析失败，请改用复制粘贴文本。')
    } finally {
      setIsParsingFile(false)
    }
  }

  const selectMaterial = (materialId: string) => {
    setState((current) => ({ ...current, activeMaterialId: materialId }))
    setSessionIds([])
    setSessionIndex(0)
    setFeedback(null)
    setAnswer('')
  }

  const startPractice = (mode: 'all' | 'wrong' | 'weak' = 'all') => {
    if (!activeMaterial) return
    const ids = buildSession(activeMaterial, mode)
    setSessionIds(ids)
    setSessionIndex(0)
    setFeedback(null)
    setAnswer('')
    setView('drill')
  }

  const submitAnswer = (markedUnfamiliar = false) => {
    if (!activeMaterial || !activeQuestion) return
    const userAnswer = markedUnfamiliar ? answer || '标记不熟' : answer
    if (!markedUnfamiliar && !userAnswer.trim()) return

    const correct = markedUnfamiliar ? false : evaluateAnswer(activeQuestion, userAnswer)
    const attempt = createAttempt({
      materialId: activeMaterial.id,
      questionId: activeQuestion.id,
      knowledgePointId: activeQuestion.knowledgePointId,
      userAnswer,
      correct,
    })

    setFeedback({ question: activeQuestion, correct, userAnswer })
    setState((current) => ({
      ...current,
      attempts: [attempt, ...current.attempts].slice(0, 500),
      materials: current.materials.map((material) => {
        if (material.id !== activeMaterial.id) return material

        return {
          ...material,
          updatedAt: new Date().toISOString(),
          questions: material.questions.map((question) => {
            if (question.id !== activeQuestion.id) return question
            return {
              ...question,
              attempts: question.attempts + 1,
              wrongCount: correct && !markedUnfamiliar ? question.wrongCount : question.wrongCount + 1,
              lastAnsweredAt: new Date().toISOString(),
              markedUnfamiliar: markedUnfamiliar ? true : question.markedUnfamiliar,
            }
          }),
          knowledgePoints: material.knowledgePoints.map((point) => {
            if (point.id !== activeQuestion.knowledgePointId) return point
            return updateKnowledgePoint(point, correct, markedUnfamiliar)
          }),
        }
      }),
    }))
  }

  const nextQuestion = () => {
    setAnswer('')
    setFeedback(null)
    setSessionIndex((index) => {
      if (index + 1 < sessionIds.length) return index + 1
      return index
    })
  }

  const isSessionDone = sessionIds.length > 0 && sessionIndex + 1 >= sessionIds.length && Boolean(feedback)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('materials')}>
          <span className="brand-mark">刷</span>
          <span>
            <strong>刷记</strong>
            <small>RecallDrill</small>
          </span>
        </button>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={view === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="tiny-label">当前资料</div>
          <strong>{activeMaterial?.title ?? '暂无资料'}</strong>
          <span>{activeStats.questionCount} 题 · {activeStats.masteryRate}% 掌握</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">本地 MVP · 资料驱动刷题</p>
            <h1>{getViewTitle(view)}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={() => startPractice('wrong')}>
              <RotateCcw size={17} />
              练错题
            </button>
            <button type="button" className="primary-button" onClick={() => startPractice('all')}>
              <Target size={17} />
              开始刷题
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="main-panel">
            {view === 'materials' && (
              <MaterialsView
                materials={state.materials}
                activeMaterialId={activeMaterial?.id}
                draftTitle={draftTitle}
                draftText={draftText}
                depth={depth}
                importedDocuments={importedDocuments}
                isParsingFile={isParsingFile}
                uploadError={uploadError}
                onTitleChange={setDraftTitle}
                onTextChange={setDraftText}
                onDepthChange={setDepth}
                onFiles={handleFiles}
                onRemoveDocument={(tempId) =>
                  setImportedDocuments((current) => current.filter((document) => document.tempId !== tempId))
                }
                onCreate={createMaterial}
                onSelect={selectMaterial}
                onPractice={startPractice}
              />
            )}

            {view === 'drill' && (
              <DrillView
                material={activeMaterial}
                question={activeQuestion}
                feedback={feedback}
                answer={answer}
                sessionIndex={sessionIndex}
                sessionTotal={sessionIds.length || activeMaterial?.questions.length || 0}
                isSessionDone={isSessionDone}
                onAnswer={setAnswer}
                onSubmit={() => submitAnswer(false)}
                onUnfamiliar={() => submitAnswer(true)}
                onNext={nextQuestion}
                onPracticeWrong={() => startPractice('wrong')}
              />
            )}

            {view === 'wrong' && (
              <WrongBookView
                material={activeMaterial}
                questions={wrongQuestions}
                onPracticeWrong={() => startPractice('wrong')}
                onPracticeWeak={() => startPractice('weak')}
              />
            )}

            {view === 'mastery' && <MasteryView material={activeMaterial} stats={activeStats} />}
          </section>

          <RightRail material={activeMaterial} stats={activeStats} weakPoints={weakPoints} wrongCount={wrongQuestions.length} />
        </div>
      </main>
    </div>
  )
}

function MaterialsView(props: {
  materials: Material[]
  activeMaterialId?: string
  draftTitle: string
  draftText: string
  depth: GenerationDepth
  importedDocuments: ImportedDocument[]
  isParsingFile: boolean
  uploadError: string
  onTitleChange: (value: string) => void
  onTextChange: (value: string) => void
  onDepthChange: (value: GenerationDepth) => void
  onFiles: (files?: FileList | File[]) => void
  onRemoveDocument: (tempId: string) => void
  onCreate: () => void
  onSelect: (materialId: string) => void
  onPractice: (mode?: 'all' | 'wrong' | 'weak') => void
}) {
  return (
    <div className="stack">
      <section className="upload-panel">
        <div className="section-heading">
          <div>
            <h2>上传或粘贴资料</h2>
            <p>生成结果会保存到浏览器本地，每道题都绑定原文片段。</p>
          </div>
          <Sparkles size={22} />
        </div>

        <div className="upload-form">
          <label className="field">
            <span>资料标题</span>
            <input value={props.draftTitle} onChange={(event) => props.onTitleChange(event.target.value)} />
          </label>

          <label className="file-drop">
            <input
              type="file"
              multiple
              accept=".txt,.md,.markdown,.pdf,.docx,.srt,.vtt"
              onChange={(event) => {
                props.onFiles(event.target.files ?? undefined)
                event.currentTarget.value = ''
              }}
            />
            <FileUp size={20} />
            <span>
              {props.isParsingFile
                ? '正在解析文件...'
                : props.importedDocuments.length > 0
                  ? `已选择 ${props.importedDocuments.length} 个文档`
                  : '选择 TXT / Markdown / PDF / DOCX / 字幕文件'}
            </span>
          </label>

          {props.importedDocuments.length > 0 && (
            <div className="document-list">
              {props.importedDocuments.map((document) => (
                <div key={document.tempId} className="document-chip">
                  <FileUp size={15} />
                  <span>{document.title}</span>
                  <small>{formatKind(document.kind)} · {document.rawText.length.toLocaleString()} 字符</small>
                  <button type="button" onClick={() => props.onRemoveDocument(document.tempId)} aria-label={`移除 ${document.title}`}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="field">
            <span>资料内容</span>
            <textarea
              value={props.draftText}
              onChange={(event) => props.onTextChange(event.target.value)}
              placeholder="也可以继续粘贴课堂笔记、Markdown、课程字幕或专业资料，会和已选文档合并生成。"
            />
          </label>

          <div className="segmented" role="radiogroup" aria-label="生成强度">
            {(['quick', 'standard', 'deep'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={props.depth === item ? 'active' : ''}
                onClick={() => props.onDepthChange(item)}
              >
                {item === 'quick' ? '快速' : item === 'standard' ? '标准' : '深度'}
              </button>
            ))}
          </div>

          {props.uploadError && (
            <div className="error-line">
              <AlertCircle size={16} />
              {props.uploadError}
            </div>
          )}

          <button type="button" className="primary-button wide" onClick={props.onCreate}>
            <Upload size={17} />
            生成知识点和题目
          </button>
        </div>
      </section>

      <section>
        <div className="section-heading compact">
          <h2>资料列表</h2>
          <span>{props.materials.length} 份资料</span>
        </div>
        <div className="material-list">
          {props.materials.map((material) => {
            const stats = getMaterialStats(material)
            return (
              <article
                key={material.id}
                className={props.activeMaterialId === material.id ? 'material-row active' : 'material-row'}
              >
                <button type="button" onClick={() => props.onSelect(material.id)}>
                  <BookOpen size={18} />
                  <span>
                    <strong>{material.title}</strong>
                    <small>
                      {getDocumentCount(material)} 个文档 · {material.knowledgePoints.length} 个知识点 · {material.questions.length} 题 ·{' '}
                      {stats.masteryRate}% 掌握
                    </small>
                  </span>
                </button>
                <button type="button" className="row-action" onClick={() => props.onPractice('all')}>
                  练习
                  <ChevronRight size={16} />
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function DrillView(props: {
  material?: Material
  question?: Question
  feedback: { question: Question; correct: boolean; userAnswer: string } | null
  answer: string
  sessionIndex: number
  sessionTotal: number
  isSessionDone: boolean
  onAnswer: (value: string) => void
  onSubmit: () => void
  onUnfamiliar: () => void
  onNext: () => void
  onPracticeWrong: () => void
}) {
  if (!props.material || !props.question) {
    return (
      <EmptyState
        icon={Target}
        title="还没有可练习的题目"
        body="先上传资料，系统会提取知识点并生成可追溯题目。"
      />
    )
  }

  const point = props.material.knowledgePoints.find((item) => item.id === props.question?.knowledgePointId)
  const answered = Boolean(props.feedback)

  return (
    <div className="drill-layout">
      <div className="question-card">
        <div className="question-meta">
          <span>{props.question.type === 'single' ? '单选题' : props.question.type === 'judge' ? '判断题' : '填空题'}</span>
          <span>
            {Math.min(props.sessionIndex + 1, props.sessionTotal)} / {props.sessionTotal}
          </span>
        </div>

        <h2>{props.question.stem}</h2>

        {props.question.options ? (
          <div className="option-list">
            {props.question.options.map((option, index) => (
              <button
                key={option}
                type="button"
                className={props.answer === option ? 'option selected' : 'option'}
                onClick={() => props.onAnswer(option)}
                disabled={answered}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className="blank-answer"
            value={props.answer}
            onChange={(event) => props.onAnswer(event.target.value)}
            disabled={answered}
            placeholder="输入你的答案"
          />
        )}

        <div className="question-actions">
          {!answered ? (
            <>
              <button type="button" className="ghost-button" onClick={props.onUnfamiliar}>
                <Highlighter size={17} />
                标记不熟
              </button>
              <button type="button" className="primary-button" onClick={props.onSubmit}>
                <Check size={17} />
                提交
              </button>
            </>
          ) : props.isSessionDone ? (
            <>
              <button type="button" className="ghost-button" onClick={props.onPracticeWrong}>
                <RotateCcw size={17} />
                继续练错题
              </button>
              <button type="button" className="primary-button" onClick={props.onNext}>
                本轮完成
              </button>
            </>
          ) : (
            <button type="button" className="primary-button" onClick={props.onNext}>
              下一题
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </div>

      <aside className={answered ? 'answer-panel visible' : 'answer-panel'}>
        {props.feedback ? (
          <>
            <div className={props.feedback.correct ? 'result is-correct' : 'result is-wrong'}>
              {props.feedback.correct ? <Check size={18} /> : <X size={18} />}
              {props.feedback.correct ? '答对了' : '需要复习'}
            </div>
            <dl className="answer-list">
              <div>
                <dt>正确答案</dt>
                <dd>{props.feedback.question.answer}</dd>
              </div>
              <div>
                <dt>解析</dt>
                <dd>{props.feedback.question.explanation}</dd>
              </div>
              <div>
                <dt>原文依据</dt>
                <dd>{props.feedback.question.sourceExcerpt}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <div className="source-box">
              <span>知识点</span>
              <strong>{point?.title}</strong>
              <small>{point?.sourceLocation}</small>
            </div>
            <p className="muted">提交后会显示正确答案、解析和原文依据。</p>
          </>
        )}
      </aside>
    </div>
  )
}

function WrongBookView(props: {
  material?: Material
  questions: Question[]
  onPracticeWrong: () => void
  onPracticeWeak: () => void
}) {
  if (!props.material) return null

  return (
    <div className="stack">
      <div className="wrong-header">
        <div>
          <h2>{props.questions.length} 道待复习</h2>
          <p>答错或标记不熟的题会按薄弱程度优先出现。</p>
        </div>
        <div className="button-row">
          <button type="button" className="ghost-button" onClick={props.onPracticeWeak}>
            练薄弱点
          </button>
          <button type="button" className="primary-button" onClick={props.onPracticeWrong}>
            重新练错题
          </button>
        </div>
      </div>

      {props.questions.length === 0 ? (
        <EmptyState icon={Archive} title="暂时没有错题" body="开始刷题后，答错和不熟的题会自动进入这里。" />
      ) : (
        <div className="wrong-list">
          {props.questions.map((question) => {
            const point = props.material?.knowledgePoints.find((item) => item.id === question.knowledgePointId)
            return (
              <article key={question.id} className="wrong-item">
                <div>
                  <span className="type-chip">{question.type === 'single' ? '单选' : question.type === 'judge' ? '判断' : '填空'}</span>
                  <h3>{question.stem}</h3>
                  <p>{point?.title}</p>
                </div>
                <div className="wrong-metrics">
                  <strong>{question.wrongCount}</strong>
                  <span>错误/不熟</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MasteryView(props: { material?: Material; stats: ReturnType<typeof getMaterialStats> }) {
  if (!props.material) return null

  const grouped = props.material.knowledgePoints.reduce<Record<string, typeof props.material.knowledgePoints>>((acc, point) => {
    acc[point.topic] = [...(acc[point.topic] ?? []), point]
    return acc
  }, {})

  return (
    <div className="stack">
      <section className="mastery-summary">
        <Metric label="掌握率" value={`${props.stats.masteryRate}%`} />
        <Metric label="知识点" value={String(props.stats.pointCount)} />
        <Metric label="已练题目" value={String(props.stats.answeredCount)} />
        <Metric label="错题" value={String(props.stats.wrongCount)} />
      </section>

      <section className="topic-list">
        {Object.entries(grouped).map(([topic, points]) => {
          const mastered = points.filter((point) => point.mastery === 'mastered' || point.mastery === 'familiar').length
          return (
            <article key={topic} className="topic-block">
              <div className="topic-title">
                <h2>{topic}</h2>
                <span>
                  {mastered}/{points.length}
                </span>
              </div>
              <div className="kp-list">
                {points.map((point) => (
                  <div key={point.id} className="kp-row">
                    <CircleDot size={15} />
                    <span>{point.title}</span>
                    <mark className={masteryClass[point.mastery]}>{masteryLabel[point.mastery]}</mark>
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function RightRail(props: {
  material?: Material
  stats: ReturnType<typeof getMaterialStats>
  weakPoints: Material['knowledgePoints']
  wrongCount: number
}) {
  return (
    <aside className="right-rail">
      <section className="rail-card accent-card">
        <div>
          <span>掌握率</span>
          <strong>{props.stats.masteryRate}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${props.stats.masteryRate}%` }} />
        </div>
      </section>

      <section className="rail-card">
        <div className="rail-title">
          <Brain size={18} />
          <h2>复习队列</h2>
        </div>
        <div className="queue-grid">
          <Metric label="错题" value={String(props.wrongCount)} />
          <Metric label="薄弱" value={String(props.stats.weakCount)} />
        </div>
      </section>

      <section className="rail-card">
        <div className="rail-title">
          <AlertCircle size={18} />
          <h2>优先知识点</h2>
        </div>
        {props.weakPoints.length === 0 ? (
          <p className="muted">当前没有明显薄弱点。</p>
        ) : (
          <div className="weak-list">
            {props.weakPoints.map((point) => (
              <div key={point.id}>
                <span>{point.title}</span>
                <mark className={masteryClass[point.mastery]}>{masteryLabel[point.mastery]}</mark>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  )
}

function EmptyState(props: { icon: typeof Target; title: string; body: string }) {
  const Icon = props.icon
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h2>{props.title}</h2>
      <p>{props.body}</p>
    </div>
  )
}

function getViewTitle(view: ViewId) {
  if (view === 'materials') return '资料转题'
  if (view === 'drill') return '开始刷题'
  if (view === 'wrong') return '错题复习'
  return '掌握情况'
}

function getDocumentCount(material?: Material) {
  if (!material) return 0
  return material.documents?.length ?? 1
}

function formatKind(kind: MaterialDocument['kind']) {
  if (kind === 'markdown') return 'Markdown'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'docx') return 'DOCX'
  if (kind === 'subtitle') return '字幕'
  if (kind === 'note') return '笔记'
  return '文本'
}

function getMaterialStats(material?: Material) {
  if (!material) {
    return { pointCount: 0, questionCount: 0, answeredCount: 0, wrongCount: 0, weakCount: 0, masteryRate: 0 }
  }

  const mastered = material.knowledgePoints.filter(
    (point) => point.mastery === 'mastered' || point.mastery === 'familiar',
  ).length
  const answeredCount = material.questions.filter((question) => question.attempts > 0).length
  const wrongCount = material.questions.filter((question) => question.wrongCount > 0 || question.markedUnfamiliar).length
  const weakCount = material.knowledgePoints.filter((point) => point.mastery === 'weak' || point.mastery === 'new').length

  return {
    pointCount: material.knowledgePoints.length,
    questionCount: material.questions.length,
    answeredCount,
    wrongCount,
    weakCount,
    masteryRate: material.knowledgePoints.length ? Math.round((mastered / material.knowledgePoints.length) * 100) : 0,
  }
}

function pickNextQuestion(material: Material) {
  return [...material.questions].sort((a, b) => {
    const pointA = material.knowledgePoints.find((point) => point.id === a.knowledgePointId)
    const pointB = material.knowledgePoints.find((point) => point.id === b.knowledgePointId)
    return questionPriority(b, pointB) - questionPriority(a, pointA)
  })[0]
}

function buildSession(material: Material, mode: 'all' | 'wrong' | 'weak') {
  let questions = [...material.questions]

  if (mode === 'wrong') {
    questions = questions.filter((question) => question.wrongCount > 0 || question.markedUnfamiliar)
  }

  if (mode === 'weak') {
    const weakIds = new Set(
      material.knowledgePoints
        .filter((point) => point.mastery === 'weak' || point.mastery === 'new')
        .map((point) => point.id),
    )
    questions = questions.filter((question) => weakIds.has(question.knowledgePointId))
  }

  const sorted = questions.sort((a, b) => {
    const pointA = material.knowledgePoints.find((point) => point.id === a.knowledgePointId)
    const pointB = material.knowledgePoints.find((point) => point.id === b.knowledgePointId)
    return questionPriority(b, pointB) - questionPriority(a, pointA)
  })

  return (sorted.length ? sorted : material.questions).map((question) => question.id)
}

function loadState(): AppState {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (!cached) return createInitialState()
    const parsed = JSON.parse(cached) as AppState
    if (!Array.isArray(parsed.materials) || parsed.materials.length === 0) return createInitialState()
    return parsed
  } catch {
    return createInitialState()
  }
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(`# 第 ${pageNumber} 页\n${text}`)
  }

  return pages.join('\n\n')
}

async function readDocumentFile(file: File): Promise<ImportedDocument> {
  const kind = inferKind(file.name)
  const rawText = kind === 'pdf' ? await readPdf(file) : kind === 'docx' ? await readDocx(file) : await file.text()

  if (rawText.trim().length < 16) {
    throw new Error(`${file.name} 没有解析出足够文本。`)
  }

  return {
    tempId: `${file.name}-${file.size}-${file.lastModified}`,
    title: file.name,
    kind,
    rawText,
  }
}

async function readDocx(file: File) {
  const mammoth = await import('mammoth')
  const data = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: data })
  return result.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
}

export default App
