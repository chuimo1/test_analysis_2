'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

// ── 더미 분석 데이터 ─────────────────────────────────────────────
const DUMMY = {
  subject: '국어',
  grade: '고2',
  school: '○○고등학교',
  examYear: 2025,
  examTerm: '1학기 중간고사',

  questions: [
    { number: 1,  type: '객관식', mainUnit: '문학',  subUnit: '현대시',   source: '', intent: '주제찾기',  expectedCorrectRate: 82, difficulty: '중',  score: '-' },
    { number: 2,  type: '객관식', mainUnit: '문학',  subUnit: '현대시',   source: '', intent: '내용파악',  expectedCorrectRate: 78, difficulty: '중',  score: '-' },
    { number: 3,  type: '객관식', mainUnit: '문학',  subUnit: '현대소설', source: '', intent: '의미파악',  expectedCorrectRate: 65, difficulty: '중상', score: '-' },
    { number: 4,  type: '객관식', mainUnit: '문학',  subUnit: '현대소설', source: '', intent: '시제파악',  expectedCorrectRate: 70, difficulty: '중',  score: '-' },
    { number: 5,  type: '객관식', mainUnit: '문학',  subUnit: '현대소설', source: '', intent: '주제찾기',  expectedCorrectRate: 55, difficulty: '중상', score: '-' },
    { number: 6,  type: '객관식', mainUnit: '독서',  subUnit: '비문학',   source: '', intent: '내용파악',  expectedCorrectRate: 72, difficulty: '중',  score: '-' },
    { number: 7,  type: '객관식', mainUnit: '독서',  subUnit: '비문학',   source: '', intent: '의미파악',  expectedCorrectRate: 60, difficulty: '중상', score: '-' },
    { number: 8,  type: '객관식', mainUnit: '독서',  subUnit: '비문학',   source: '', intent: '함의찾기',  expectedCorrectRate: 48, difficulty: '상',  score: '-' },
    { number: 9,  type: '객관식', mainUnit: '문법',  subUnit: '음운론',   source: '', intent: '개념파악',  expectedCorrectRate: 85, difficulty: '하',  score: '-' },
    { number: 10, type: '객관식', mainUnit: '문법',  subUnit: '형태론',   source: '', intent: '개념파악',  expectedCorrectRate: 75, difficulty: '중',  score: '-' },
    { number: 11, type: '객관식', mainUnit: '문학',  subUnit: '고전시가', source: '', intent: '내용파악',  expectedCorrectRate: 58, difficulty: '중상', score: '-' },
    { number: 12, type: '객관식', mainUnit: '문학',  subUnit: '고전시가', source: '', intent: '의미파악',  expectedCorrectRate: 45, difficulty: '상',  score: '-' },
    { number: 13, type: '객관식', mainUnit: '독서',  subUnit: '비문학',   source: '', intent: '주제찾기',  expectedCorrectRate: 68, difficulty: '중',  score: '-' },
    { number: 14, type: '객관식', mainUnit: '독서',  subUnit: '비문학',   source: '', intent: '함의찾기',  expectedCorrectRate: 42, difficulty: '상',  score: '-' },
    { number: 15, type: '서술형', mainUnit: '문학',  subUnit: '현대시',   source: '', intent: '감상하기',  expectedCorrectRate: 50, difficulty: '중상', score: '-' },
  ],

  keyFeatures: [
    '객관식 14문항 + 서술형 1문항으로 구성',
    '의미파악·함의찾기 비중 높음 (5문항)',
    '비문학 출제 비중 증가 (5문항)',
    '상 난이도 문항 3개 (20%), 전반적 어려운 편',
  ],
  yearOverYearComparison: '전년도 대비 난이도 상승 (중 → 중상). 예상 평균점수 하락 (72점 → 65점). 서술형 비중 소폭 증가, 함의찾기 유형 신규 출제.',

  killerQuestions: [
    { number: 8,  subUnit: '비문학',   intent: '함의찾기', difficulty: '상', rate: 48, reason: '다층적 의미 해석 + 유사 선택지 구성' },
    { number: 14, subUnit: '비문학',   intent: '함의찾기', difficulty: '상', rate: 42, reason: '긴 지문 + 추론 능력 요구' },
    { number: 12, subUnit: '고전시가', intent: '의미파악', difficulty: '상', rate: 45, reason: '고전 어휘 이해 + 시대적 맥락 파악 필요' },
  ],

  strategies: [
    { trend: '함의찾기·의미파악 비중 급증',   strategy: '함의 유형 집중 학습 — 지문 핵심문 파악 후 선택지 비교' },
    { trend: '비문학 출제 증가 (5문항)',        strategy: '비문학 독해 훈련 강화 — 단락별 주제문 찾기 연습' },
    { trend: '상 난이도 3문항 (20%)',           strategy: '고난도 문항 풀이 전략 습득 — 오답 원인 분석 반복' },
    { trend: '고전시가 의미파악 신규 출제',     strategy: '고전 어휘 암기 + 시대적 맥락 이해 중심 학습' },
  ],
}

// ── 차트 계산 ────────────────────────────────────────────────────
const DIFFICULTY_ORDER = ['상', '중상', '중', '중하', '하'] as const
const DIFF_COLOR: Record<string, string> = {
  상: '#ef4444', 중상: '#f97316', 중: '#eab308', 중하: '#22c55e', 하: '#3b82f6',
}

function getDiffData(qs: typeof DUMMY.questions) {
  const c: Record<string, number> = {}
  qs.forEach((q) => { c[q.difficulty] = (c[q.difficulty] ?? 0) + 1 })
  return DIFFICULTY_ORDER.filter((d) => c[d]).map((d) => ({ name: d, value: c[d], color: DIFF_COLOR[d] }))
}

function getSubUnitData(qs: typeof DUMMY.questions) {
  const map: Record<string, Record<string, number>> = {}
  qs.forEach((q) => {
    if (!map[q.subUnit]) map[q.subUnit] = {}
    map[q.subUnit][q.difficulty] = (map[q.subUnit][q.difficulty] ?? 0) + 1
  })
  return Object.entries(map).map(([subUnit, diffs]) => ({ subUnit, ...diffs }))
}

function getSourceData(qs: typeof DUMMY.questions) {
  const map: Record<string, Record<string, number>> = {}
  qs.forEach((q) => {
    const src = q.source || '미입력'
    if (!map[src]) map[src] = {}
    map[src][q.difficulty] = (map[src][q.difficulty] ?? 0) + 1
  })
  return Object.entries(map).map(([source, diffs]) => ({ source, ...diffs }))
}

function getMainUnitData(qs: typeof DUMMY.questions) {
  const map: Record<string, Record<string, number>> = {}
  qs.forEach((q) => {
    const unit = q.mainUnit || '미입력'
    if (!map[unit]) map[unit] = {}
    map[unit][q.difficulty] = (map[unit][q.difficulty] ?? 0) + 1
  })
  return Object.entries(map).map(([mainUnit, diffs]) => ({ mainUnit, ...diffs }))
}

// 국어/영어는 출처 방식, 수학/사회는 단원 방식
const SOURCE_SUBJECTS = ['국어', '영어']
const SOURCE_OPTIONS = ['교과서', '모의고사', '부교재', '학습지', '기타']

const DIFF_BADGE: Record<string, string> = {
  상: 'bg-red-100 text-red-700',
  중상: 'bg-orange-100 text-orange-700',
  중: 'bg-yellow-100 text-yellow-700',
  중하: 'bg-green-100 text-green-700',
  하: 'bg-blue-100 text-blue-700',
}

// ── 페이지 ────────────────────────────────────────────────────────
function AnalysisContent() {
  const params = useParams()
  const examId = params.id as string
  const searchParams = useSearchParams()
  const [data, setData] = useState(DUMMY)
  const [saved, setSaved] = useState(false)
  const [examDbId, setExamDbId] = useState<string | null>(null)
  const [view, setView] = useState<'analysis' | 'blog'>('analysis')
  const [blogHtml, setBlogHtml] = useState('')
  const [blogEditing, setBlogEditing] = useState(false)
  const [teacherComment, setTeacherComment] = useState('')

  useEffect(() => {
    import('@/lib/db').then(({ getExamById }) => {
      getExamById(examId).then((exam) => {
        if (!exam?.analysis) return
        const parsed = exam.analysis as Record<string, unknown>
        setExamDbId(exam.id)
        const sanitized = {
          ...DUMMY,
          subject: exam.subject,
          grade: exam.grade,
          school: exam.school,
          examYear: exam.exam_year,
          examTerm: exam.exam_term,
          questions: ((parsed.questions as Record<string, unknown>[]) ?? []).map((q) => ({
            number: (q.number as number) ?? 0,
            type: (q.type as string) ?? '객관식',
            mainUnit: (q.mainUnit as string) ?? '',
            subUnit: (q.subUnit as string) ?? '',
            source: (q.source as string) ?? '',
            intent: (q.intent as string) ?? '',
            expectedCorrectRate: (q.expectedCorrectRate as number) ?? 0,
            difficulty: (q.difficulty as string) ?? '중',
            score: (q.score as string) ?? '-',
          })),
          keyFeatures: ((parsed.keyFeatures as string[]) ?? []).map((f) => String(f ?? '')),
          yearOverYearComparison: String(parsed.yearOverYearComparison ?? ''),
          killerQuestions: ((parsed.killerQuestions as Record<string, unknown>[]) ?? []).map((k) => ({
            number: (k.number as number) ?? 0,
            subUnit: (k.subUnit as string) ?? '',
            intent: (k.intent as string) ?? '',
            difficulty: (k.difficulty as string) ?? '상',
            rate: (k.rate as number) ?? 0,
            reason: (k.reason as string) ?? '',
          })),
          strategies: ((parsed.strategies as Record<string, unknown>[]) ?? []).map((s) => ({
            trend: (s.trend as string) ?? '',
            strategy: (s.strategy as string) ?? '',
          })),
        }
        setData(sanitized)
      })
    })
  }, [examId])

  // 출제 현황 셀 수정
  function updateQuestion(idx: number, field: string, value: string | number) {
    setData((prev) => {
      const questions = prev.questions.map((q, i) =>
        i === idx ? { ...q, [field]: value } : q
      )
      return { ...prev, questions }
    })
  }

  function addQuestion() {
    setData((prev) => {
      const nextNum = prev.questions.length === 0
        ? 1
        : Math.max(...prev.questions.map((q) => q.number)) + 1
      return {
        ...prev,
        questions: [
          ...prev.questions,
          {
            number: nextNum,
            type: '객관식',
            mainUnit: '',
            subUnit: '',
            source: '',
            intent: '',
            expectedCorrectRate: 0,
            difficulty: '중' as const,
            score: '-' as const,
          },
        ],
      }
    })
  }

  function removeQuestion(idx: number) {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }))
  }

  const [reanalyzingIdx, setReanalyzingIdx] = useState<number | null>(null)
  async function reanalyzeQuestion(idx: number) {
    setReanalyzingIdx(idx)
    try {
      // TODO: 실제 AI 재분석 API 연동
      await new Promise((r) => setTimeout(r, 1500))
    } finally {
      setReanalyzingIdx(null)
    }
  }

  // 텍스트 리스트 항목 수정
  function updateKeyFeature(idx: number, value: string) {
    setData((prev) => {
      const keyFeatures = prev.keyFeatures.map((f, i) => i === idx ? value : f)
      return { ...prev, keyFeatures }
    })
  }

  function updateYearOverYear(value: string) {
    setData((prev) => ({ ...prev, yearOverYearComparison: value }))
  }

  function updateStrategy(idx: number, field: 'trend' | 'strategy', value: string) {
    setData((prev) => {
      const strategies = prev.strategies.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      )
      return { ...prev, strategies }
    })
  }

  function updateKiller(idx: number, field: string, value: string | number) {
    setData((prev) => {
      const killerQuestions = prev.killerQuestions.map((k, i) =>
        i === idx ? { ...k, [field]: value } : k
      )
      return { ...prev, killerQuestions }
    })
  }

  function addKiller() {
    setData((prev) => {
      if (prev.killerQuestions.length >= 5) return prev
      return {
        ...prev,
        killerQuestions: [
          ...prev.killerQuestions,
          { number: 0, subUnit: '', intent: '', difficulty: '상' as const, rate: 0, reason: '' },
        ],
      }
    })
  }

  function removeKiller(idx: number) {
    setData((prev) => ({
      ...prev,
      killerQuestions: prev.killerQuestions.filter((_, i) => i !== idx),
    }))
  }

  const d = {
    ...data,
    subject:  searchParams.get('subject')  || data.subject,
    grade:    searchParams.get('grade')    || data.grade,
    school:   searchParams.get('school')   || data.school,
    examYear: Number(searchParams.get('examYear') || data.examYear),
    examTerm: searchParams.get('examTerm') || data.examTerm,
  }

  const examTitle = `${d.examYear}년 ${d.school} ${d.grade} ${d.subject} ${d.examTerm}`

  async function handleSave() {
    if (!examDbId) return
    const { updateExamAnalysis } = await import('@/lib/db')
    await updateExamAnalysis(examDbId, { ...data })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleFinalize() {
    if (!examDbId) return
    const { updateExamAnalysis, finalizeExam, updateExamBlog } = await import('@/lib/db')
    const { generateBlogHtml } = await import('@/lib/blog-html')
    await updateExamAnalysis(examDbId, { ...data })
    const finalBlog = blogHtml || generateBlogHtml({
      subject: d.subject, grade: d.grade, school: d.school,
      examYear: d.examYear, examTerm: d.examTerm,
      keyFeatures: data.keyFeatures,
      yearOverYearComparison: data.yearOverYearComparison,
      killerQuestions: data.killerQuestions,
      strategies: data.strategies,
      questions: data.questions,
      teacherComment,
    })
    await updateExamBlog(examDbId, finalBlog)
    await finalizeExam(examDbId)
    setSaved(true)
    alert(`"${examTitle}" 분석이 완료되어 실장에게 전달됐습니다.`)
    setTimeout(() => setSaved(false), 2000)
  }
  const isSourceSubject = SOURCE_SUBJECTS.includes(d.subject)
  const diffData     = getDiffData(d.questions)
  const subUnitData  = getSubUnitData(d.questions)
  const sourceData   = getSourceData(d.questions)
  const mainUnitData = getMainUnitData(d.questions)
  const activeDiffs  = DIFFICULTY_ORDER.filter((diff) => d.questions.some((q) => q.difficulty === diff))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">품격에듀</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/teacher" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              목록으로
            </Link>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
              <button onClick={() => setView('analysis')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'analysis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                분석
              </button>
              <button onClick={() => setView('blog')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${view === 'blog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                블로그 미리보기
              </button>
            </div>
            <button onClick={handleSave}
              className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition">
              {saved ? '저장됨 ✓' : '임시 저장'}
            </button>
            <button onClick={handleFinalize}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
              수정 완료 · 실장 전달
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 제목 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {d.examYear}년 {d.school} {d.grade} {d.examTerm}
          </h1>
          <p className="text-gray-500 text-sm mt-1">과목: {d.subject}</p>
        </div>

        {/* 블로그 미리보기 모드 — 실시간 데이터 반영 */}
        {view === 'blog' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">분석 탭에서 수정한 내용이 실시간 반영됩니다. 코멘트를 추가하고 &quot;수정 완료 · 실장 전달&quot;을 누르세요.</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setBlogEditing(!blogEditing)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition ${blogEditing ? 'bg-green-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {blogEditing ? 'HTML 편집 닫기' : 'HTML 직접 편집'}
                </button>
                <button onClick={async () => {
                  const { generateBlogHtml } = await import('@/lib/blog-html')
                  const html = generateBlogHtml({
                    subject: d.subject, grade: d.grade, school: d.school,
                    examYear: d.examYear, examTerm: d.examTerm,
                    keyFeatures: data.keyFeatures,
                    yearOverYearComparison: data.yearOverYearComparison,
                    killerQuestions: data.killerQuestions,
                    strategies: data.strategies,
                    questions: data.questions,
                    teacherComment,
                  })
                  await navigator.clipboard.writeText(html)
                  alert('HTML이 클립보드에 복사됐습니다!')
                }}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition">
                  HTML 복사
                </button>
              </div>
            </div>

            {blogEditing && (
              <textarea
                value={blogHtml}
                onChange={(e) => setBlogHtml(e.target.value)}
                className="w-full h-[500px] font-mono text-xs text-gray-800 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
            )}

            {!blogEditing && (
              <div className="space-y-8">
                {/* 블로그 제목 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-8">
                  <h1 className="text-2xl font-bold text-gray-900 border-b-2 border-indigo-500 pb-3 mb-4">
                    {d.examYear}년 {d.school} {d.grade} {d.examTerm} {d.subject} 분석
                  </h1>
                  <p className="text-gray-600">안녕하세요, <strong>품격에듀</strong>입니다! {d.examTerm} {d.subject} 시험을 분석한 결과를 공유합니다.</p>
                </div>

                {/* 시험 개요 */}
                <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
                  <h2 className="text-lg font-bold text-blue-900 mb-2">📊 시험 개요</h2>
                  <p className="text-blue-800">
                    총 <strong>{data.questions.length}문항</strong> · 예상 평균정답률 <strong>{data.questions.length > 0 ? Math.round(data.questions.reduce((s, q) => s + q.expectedCorrectRate, 0) / data.questions.length) : 0}%</strong>
                  </p>
                </div>

                {/* 난이도 + 출처 차트 (분석탭과 동일) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-4">📊 난이도별 비중</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={diffData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false} fontSize={11}>
                          {diffData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v}문항`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                      {diffData.map((dd) => (
                        <div key={dd.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dd.color }} />
                          {dd.name} {dd.value}문항
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-base font-bold text-gray-900 mb-4">📚 대단원별 분석</h2>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={mainUnitData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="mainUnit" tick={{ fontSize: 10 }} width={56} />
                        <Tooltip />
                        {activeDiffs.map((diff) => (
                          <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                </div>

                {/* 출제 현황 테이블 */}
                <section className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">📋 출제 현황</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {['번호', '유형', '대단원', '중단원', '출제의도', '난이도', '예상정답률'].map((h) => (
                            <th key={h} className="text-left py-2.5 px-3 text-gray-500 font-medium text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.questions.map((q) => (
                          <tr key={q.number} className="border-b border-gray-50">
                            <td className="py-2 px-3 font-medium text-gray-900 text-sm">{q.number}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{q.type}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{q.mainUnit}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{q.subUnit}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{q.intent}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFF_BADGE[q.difficulty]}`}>{q.difficulty}</span>
                            </td>
                            <td className="py-2 px-3 text-sm font-medium" style={{ color: q.expectedCorrectRate <= 40 ? '#ef4444' : q.expectedCorrectRate <= 60 ? '#f97316' : '#22c55e' }}>
                              {q.expectedCorrectRate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 주요 특징 */}
                <section className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">📋 주요 특징</h2>
                  <ul className="space-y-2">
                    {data.keyFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-indigo-500 mt-0.5">✅</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* 전년도 비교 */}
                <section className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">📈 전년도 비교</h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.yearOverYearComparison}</p>
                </section>

                {/* 킬러문항 */}
                <section className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">🔥 킬러문항 분석</h2>
                  <div className="space-y-3">
                    {data.killerQuestions.map((k, i) => (
                      <div key={i} className="border-l-4 border-red-400 bg-red-50 rounded-r-xl p-4">
                        <p className="text-sm font-semibold text-red-700 mb-1">
                          {k.number}번 &nbsp;{k.subUnit} · {k.intent} · 예상정답률 {k.rate}%
                        </p>
                        <p className="text-sm text-gray-600">{k.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 전략 */}
                <section className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">💡 다음 시험 대비 전략</h2>
                  <div className="space-y-3">
                    {data.strategies.map((s, i) => (
                      <div key={i} className="border-l-4 border-indigo-400 bg-indigo-50 rounded-r-xl p-4">
                        <p className="text-sm font-semibold text-indigo-700 mb-1">📌 {s.trend}</p>
                        <p className="text-sm text-gray-600">→ {s.strategy}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 강사 코멘트 */}
                <section className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">✏️ 강사 코멘트</h2>
                  <p className="text-xs text-gray-400 mb-3">블로그 글 하단에 추가될 강사 의견입니다. 학부모·학생에게 전달할 메시지를 자유롭게 작성하세요.</p>
                  <textarea
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    placeholder="예: 이번 시험은 전반적으로 함수 파트에서 변별력을 두었습니다. 다음 시험 대비 시 이차함수의 활용 문제를 집중적으로 연습하세요."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-y leading-relaxed"
                  />
                </section>
              </div>
            )}
          </>
        )}

        {view === 'analysis' && <>
        {/* ① 출제 현황 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 출제 현황</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    '문제', '유형',
                    ...(isSourceSubject ? ['유형', '출처'] : ['대단원', '중단원', '출처']),
                    '출제자 의도', '예상 정답률', '난이도', '배점', ''
                  ].map((h, i) => (
                    <th key={i} className="text-left py-3 px-3 text-gray-500 font-medium text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.questions.map((q, idx) => (
                  <tr key={q.number} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-3 px-3 font-medium text-gray-900">{q.number}번</td>
                    <td className="py-2 px-3">
                      <select value={q.type} onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        {['객관식','단답형','서술형'].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input value={q.mainUnit} onChange={(e) => updateQuestion(idx, 'mainUnit', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    {/* 국어/영어: 출처 드롭다운 | 수학/사회: 중단원 입력 + 출처 드롭다운 */}
                    <td className="py-2 px-3">
                      {isSourceSubject ? (
                        <select value={q.source || ''} onChange={(e) => updateQuestion(idx, 'source', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                          <option value="">선택</option>
                          {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input value={q.subUnit} onChange={(e) => updateQuestion(idx, 'subUnit', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      )}
                    </td>
                    {/* 수학/사회 전용 출처 열 */}
                    {!isSourceSubject && (
                      <td className="py-2 px-3">
                        <select value={q.source || ''} onChange={(e) => updateQuestion(idx, 'source', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                          <option value="">선택</option>
                          {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                    )}
                    <td className="py-2 px-3">
                      <input value={q.intent} onChange={(e) => updateQuestion(idx, 'intent', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="py-2 px-3">
                      <input type="number" value={q.expectedCorrectRate} min={0} max={100}
                        onChange={(e) => updateQuestion(idx, 'expectedCorrectRate', Number(e.target.value))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-14 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="py-2 px-3">
                      <select value={q.difficulty} onChange={(e) => updateQuestion(idx, 'difficulty', e.target.value)}
                        className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${DIFF_BADGE[q.difficulty]}`}>
                        {DIFFICULTY_ORDER.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input value={q.score} onChange={(e) => {
                        const v = e.target.value
                        updateQuestion(idx, 'score', v === '-' ? '-' : Number(v) || '-')
                      }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-12 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => reanalyzeQuestion(idx)} disabled={reanalyzingIdx === idx} title="이 문항만 AI 재분석"
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center disabled:opacity-50">
                          {reanalyzingIdx === idx ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                        <button onClick={() => removeQuestion(idx)} title="문항 삭제"
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex items-center justify-center">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addQuestion} type="button"
            className="mt-3 w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition">
            + 문항 추가
          </button>
        </section>

        {/* ② 차트 4개 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 난이도별 비중 - 원형 */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📊 난이도별 비중</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={diffData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={11}>
                  {diffData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v}문항`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
              {diffData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  {d.name} {d.value}문항
                </div>
              ))}
            </div>
          </section>

          {/* 출처별 분석 - 막대 */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📂 출처별 분석</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} width={56} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* 대단원별 분석 - 막대 */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📚 대단원별 분석</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mainUnitData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="mainUnit" tick={{ fontSize: 10 }} width={56} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* 중단원별 분석 - 막대 */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📖 중단원별 분석</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={subUnitData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="subUnit" tick={{ fontSize: 10 }} width={56} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>

        {/* ③ 시험 총평 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">🎯 시험 총평</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">주요 특징</h3>
              <ul className="space-y-2">
                {data.keyFeatures.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-2.5 shrink-0">•</span>
                    <textarea value={f} onChange={(e) => updateKeyFeature(i, e.target.value)}
                      rows={2}
                      className="text-sm text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y leading-relaxed" />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">전년도 비교</h3>
              <textarea value={data.yearOverYearComparison} onChange={(e) => updateYearOverYear(e.target.value)}
                rows={6}
                className="text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-2 w-full leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
            </div>
          </div>
        </section>

        {/* ④ 킬러문항 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">🔥 킬러문항 <span className="text-xs text-gray-400 font-normal ml-1">최대 5개</span></h2>
            <span className="text-xs text-gray-400">{data.killerQuestions.length}/5</span>
          </div>
          <div className="space-y-3">
            {data.killerQuestions.map((k, i) => {
              const syncedRate = data.questions.find((q) => q.number === k.number)?.expectedCorrectRate ?? k.rate
              return (
              <div key={i} className="flex gap-4 p-4 bg-red-50 rounded-xl">
                <input type="number" value={k.number || ''} onChange={(e) => updateKiller(i, 'number', Number(e.target.value))}
                  placeholder="번호" className="w-16 h-10 bg-red-100 rounded-xl text-red-700 font-bold text-sm text-center shrink-0 focus:outline-none focus:ring-1 focus:ring-red-400" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input value={k.subUnit} onChange={(e) => updateKiller(i, 'subUnit', e.target.value)}
                      placeholder="단원"
                      className="text-xs border border-red-200 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white" />
                    <input value={k.intent} onChange={(e) => updateKiller(i, 'intent', e.target.value)}
                      placeholder="출제의도"
                      className="text-xs border border-red-200 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white" />
                    <select value={k.difficulty} onChange={(e) => updateKiller(i, 'difficulty', e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-300 ${DIFF_BADGE[k.difficulty]}`}>
                      {DIFFICULTY_ORDER.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">정답률</span>
                      <span className="text-xs font-semibold text-red-700 px-2 py-1 bg-red-100 rounded-lg w-14 text-center">{syncedRate}%</span>
                    </div>
                  </div>
                  <textarea value={k.reason} onChange={(e) => updateKiller(i, 'reason', e.target.value)}
                    placeholder="킬러문항인 이유"
                    rows={2}
                    className="text-xs border border-red-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-red-300 bg-white resize-y leading-relaxed" />
                </div>
                <div className="flex flex-col gap-1 shrink-0 items-end">
                  <button onClick={() => removeKiller(i)} title="제거"
                    className="w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 transition flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                    + 손풀이
                  </button>
                </div>
              </div>
            )})}
            {data.killerQuestions.length < 5 && (
              <button onClick={addKiller} type="button"
                className="w-full border-2 border-dashed border-red-200 rounded-xl py-3 text-sm text-red-500 hover:bg-red-50 hover:border-red-300 transition">
                + 킬러문항 추가
              </button>
            )}
          </div>
        </section>

        {/* ⑤ 다음 시험 전략 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">💡 다음 시험 전략</h2>
          <div className="space-y-3">
            {data.strategies.map((s, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                  <span className="text-xs font-semibold text-gray-400 whitespace-nowrap mt-1.5">출제경향</span>
                  <textarea value={s.trend} onChange={(e) => updateStrategy(i, 'trend', e.target.value)}
                    rows={2}
                    className="text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-y leading-relaxed" />
                </div>
                <div className="flex items-start gap-3 bg-indigo-50 rounded-xl p-4">
                  <span className="text-xs font-semibold text-indigo-400 whitespace-nowrap mt-1.5">전략</span>
                  <textarea value={s.strategy} onChange={(e) => updateStrategy(i, 'strategy', e.target.value)}
                    rows={2}
                    className="text-sm text-gray-700 border border-indigo-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white resize-y leading-relaxed" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 하단 저장 버튼 */}
        <div className="flex flex-col items-end gap-2 pb-8">
          <p className="text-xs text-gray-400">저장 제목: {examTitle}</p>
          <div className="flex gap-3">
            <button onClick={handleSave}
              className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
              {saved ? '저장됨 ✓' : '임시 저장'}
            </button>
            <button onClick={handleFinalize}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition">
              수정 완료 · 실장에게 전달
            </button>
          </div>
        </div>
        </>}
      </main>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">불러오는 중...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}
