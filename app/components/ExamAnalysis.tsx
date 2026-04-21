'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

const DUMMY = {
  subject: '국어',
  grade: '고2',
  school: '○○고등학교',
  examYear: 2025,
  examTerm: '1학기 중간고사',
  questions: [] as { number: number; type: string; mainUnit: string; subUnit: string; source: string; intent: string; expectedCorrectRate: number; difficulty: string; score: string }[],
  keyFeatures: [] as string[],
  examSummary: '',
  aiDifficulty: '',
  aiDifficultyReason: '',
  commonMistakes: [] as { area: string; description: string; tip: string }[],
  yearOverYearComparison: '',
  killerQuestions: [] as { number: number; subUnit: string; intent: string; difficulty: string; rate: number; reason: string; solutionFiles: { url: string; fileName: string; path: string }[] }[],
  strategies: [] as { trend: string; strategy: string }[],
}

const DIFFICULTY_ORDER = ['상', '중상', '중', '중하', '하'] as const
const DIFF_COLOR: Record<string, string> = {
  상: '#ef4444', 중상: '#f97316', 중: '#eab308', 중하: '#22c55e', 하: '#3b82f6',
}
const DIFF_BADGE: Record<string, string> = {
  상: 'bg-red-100 text-red-700',
  중상: 'bg-orange-100 text-orange-700',
  중: 'bg-yellow-100 text-yellow-700',
  중하: 'bg-green-100 text-green-700',
  하: 'bg-blue-100 text-blue-700',
}

const SOURCE_SUBJECTS = ['국어', '영어']
const SOURCE_OPTIONS = ['교과서', '모의고사', '부교재', '학습지', '직접입력']

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

function getIntentData(qs: typeof DUMMY.questions) {
  const map: Record<string, Record<string, number>> = {}
  qs.forEach((q) => {
    const intent = q.intent || '미입력'
    if (!map[intent]) map[intent] = {}
    map[intent][q.difficulty] = (map[intent][q.difficulty] ?? 0) + 1
  })
  return Object.entries(map).map(([intent, diffs]) => ({ intent, ...diffs }))
}

type HitQuestion = { questionNumber: number; examImage: { url: string; fileName: string; path: string } | null; hitImage: { url: string; fileName: string; path: string } | null; source: string }

interface ExamAnalysisProps {
  examId: string
  mode: 'teacher' | 'admin'
}

function ExamAnalysisContent({ examId, mode }: ExamAnalysisProps) {
  const [data, setData] = useState(DUMMY)
  const [saved, setSaved] = useState(false)
  const [examDbId, setExamDbId] = useState<string | null>(null)
  const [overallDifficulty, setOverallDifficulty] = useState('')
  const [sectionComments, setSectionComments] = useState<Record<string, string>>({})
  const [hitQuestions, setHitQuestions] = useState<HitQuestion[]>([])
  const [examMeta, setExamMeta] = useState<{ examScope: { category: string; detail: string }[]; expectedDifficulty: string; teacherNote: string }>({
    examScope: [], expectedDifficulty: '', teacherNote: '',
  })
  const [teacherName, setTeacherName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examStatus, setExamStatus] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    import('@/lib/db').then(({ getExamById }) => {
      getExamById(examId).then((exam) => {
        if (!exam?.analysis) return
        const parsed = exam.analysis as Record<string, unknown>
        setExamDbId(exam.id)
        setTeacherName(exam.users?.name ?? '강사')
        setExamDate(exam.created_at?.slice(0, 10) ?? '')
        setExamStatus(exam.blog_published_at ? '발행 완료' : exam.is_finalized ? '제출 완료' : '수정 중')
        setExamMeta({
          examScope: (exam.exam_scope as { category: string; detail: string }[]) ?? [],
          expectedDifficulty: (exam.expected_difficulty as string) ?? '',
          teacherNote: (exam.teacher_note as string) ?? '',
        })
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
          examSummary: String(parsed.examSummary ?? ''),
          aiDifficulty: String(parsed.aiDifficulty ?? ''),
          aiDifficultyReason: String(parsed.aiDifficultyReason ?? ''),
          commonMistakes: ((parsed.commonMistakes as Record<string, unknown>[]) ?? []).map((m) => ({
            area: (m.area as string) ?? '',
            description: (m.description as string) ?? '',
            tip: (m.tip as string) ?? '',
          })),
          yearOverYearComparison: String(parsed.yearOverYearComparison ?? ''),
          killerQuestions: ((parsed.killerQuestions as Record<string, unknown>[]) ?? []).map((k) => ({
            number: (k.number as number) ?? 0,
            subUnit: (k.subUnit as string) ?? '',
            intent: (k.intent as string) ?? '',
            difficulty: (k.difficulty as string) ?? '상',
            rate: (k.rate as number) ?? 0,
            reason: (k.reason as string) ?? '',
            solutionFiles: ((k.solutionFiles as { url: string; fileName: string; path: string }[]) ?? []),
          })),
          strategies: ((parsed.strategies as Record<string, unknown>[]) ?? []).map((s) => ({
            trend: (s.trend as string) ?? '',
            strategy: (s.strategy as string) ?? '',
          })),
        }
        setData(sanitized)
        setOverallDifficulty(String(parsed.aiDifficulty ?? parsed.overallDifficulty ?? ''))
        if (parsed.sectionComments) setSectionComments(parsed.sectionComments as Record<string, string>)
        if (parsed.hitQuestions) setHitQuestions(parsed.hitQuestions as HitQuestion[])
      })
    })
  }, [examId])

  function updateQuestion(idx: number, field: string, value: string | number) {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q),
    }))
  }

  function addQuestion() {
    setData((prev) => {
      const nextNum = prev.questions.length === 0 ? 1 : Math.max(...prev.questions.map((q) => q.number)) + 1
      return {
        ...prev,
        questions: [...prev.questions, { number: nextNum, type: '객관식', mainUnit: '', subUnit: '', source: '', intent: '', expectedCorrectRate: 0, difficulty: '중', score: '-' }],
      }
    })
  }

  function removeQuestion(idx: number) {
    setData((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }))
  }

  const [reanalyzingIdx, setReanalyzingIdx] = useState<number | null>(null)
  async function reanalyzeQuestion(idx: number) {
    setReanalyzingIdx(idx)
    try {
      await new Promise((r) => setTimeout(r, 1500))
    } finally {
      setReanalyzingIdx(null)
    }
  }

  function updateKeyFeature(idx: number, value: string) {
    setData((prev) => ({ ...prev, keyFeatures: prev.keyFeatures.map((f, i) => i === idx ? value : f) }))
  }

  function updateYearOverYear(value: string) {
    setData((prev) => ({ ...prev, yearOverYearComparison: value }))
  }

  function updateExamSummary(value: string) {
    setData((prev) => ({ ...prev, examSummary: value }))
  }

  function updateCommonMistake(idx: number, field: 'area' | 'description' | 'tip', value: string) {
    setData((prev) => ({
      ...prev,
      commonMistakes: prev.commonMistakes.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }))
  }

  function addCommonMistake() {
    setData((prev) => ({ ...prev, commonMistakes: [...prev.commonMistakes, { area: '', description: '', tip: '' }] }))
  }

  function removeCommonMistake(idx: number) {
    setData((prev) => ({ ...prev, commonMistakes: prev.commonMistakes.filter((_, i) => i !== idx) }))
  }

  function updateSectionComment(section: string, value: string) {
    setSectionComments((prev) => ({ ...prev, [section]: value }))
  }

  function addHitQuestion() {
    setHitQuestions((prev) => [...prev, { questionNumber: 0, examImage: null, hitImage: null, source: '' }])
  }

  function removeHitQuestion(idx: number) {
    setHitQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateHitQuestion(idx: number, field: string, value: unknown) {
    setHitQuestions((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  const hitExamInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const hitMatchInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [uploadingHitIdx, setUploadingHitIdx] = useState<{ idx: number; side: string } | null>(null)

  async function handleHitImageUpload(idx: number, side: 'examImage' | 'hitImage', files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file || !file.name) { alert('파일을 다시 선택해 주세요.'); return }
    if (!/\.(jpe?g)$/i.test(file.name) && file.type !== 'image/jpeg') {
      alert('JPG(JPEG) 파일만 업로드할 수 있습니다.')
      return
    }
    if (!examDbId) { alert('먼저 임시 저장을 해주세요. (저장 후 이미지 업로드가 가능합니다)'); return }
    const slot = side === 'examImage' ? 9000 : 9500
    setUploadingHitIdx({ idx, side })
    try {
      const { uploadSolutionFile } = await import('@/lib/db')
      const result = await uploadSolutionFile(examDbId, slot + idx, file)
      if (result.url) {
        updateHitQuestion(idx, side, { url: result.url, fileName: result.fileName!, path: result.path! })
      } else {
        alert(`업로드 실패: ${result.error ?? '알 수 없는 오류'}`)
      }
    } catch (err) {
      alert(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploadingHitIdx(null)
    }
  }

  const solutionInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [uploadingKillerIdx, setUploadingKillerIdx] = useState<number | null>(null)

  async function handleSolutionUpload(killerIdx: number, files: FileList | null) {
    if (!files || files.length === 0) return
    if (!examDbId) { alert('먼저 임시 저장을 해주세요. (저장 후 이미지 업로드가 가능합니다)'); return }
    const fileArr = Array.from(files)
    const invalid = fileArr.filter((f) => !f || !f.name)
    if (invalid.length > 0) { alert('파일을 다시 선택해 주세요.'); return }
    const nonJpg = fileArr.filter((f) => !/\.(jpe?g)$/i.test(f.name) && f.type !== 'image/jpeg')
    if (nonJpg.length > 0) {
      alert(`JPG(JPEG) 파일만 업로드할 수 있습니다.\n제외된 파일: ${nonJpg.map((f) => f.name).join(', ')}`)
      return
    }
    setUploadingKillerIdx(killerIdx)
    try {
      const { uploadSolutionFile } = await import('@/lib/db')
      const qNum = data.killerQuestions[killerIdx].number
      const newFiles: { url: string; fileName: string; path: string }[] = []
      const errors: string[] = []
      for (const file of fileArr) {
        const result = await uploadSolutionFile(examDbId, qNum, file)
        if (result.url) {
          newFiles.push({ url: result.url, fileName: result.fileName!, path: result.path! })
        } else if (result.error) {
          errors.push(`${file.name}: ${result.error}`)
        }
      }
      if (newFiles.length > 0) {
        setData((prev) => ({
          ...prev,
          killerQuestions: prev.killerQuestions.map((k, i) =>
            i === killerIdx ? { ...k, solutionFiles: [...k.solutionFiles, ...newFiles] } : k
          ),
        }))
      }
      if (errors.length > 0) alert(`일부 파일 업로드 실패:\n${errors.join('\n')}`)
    } catch (err) {
      alert(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploadingKillerIdx(null)
    }
  }

  async function removeSolutionFile(killerIdx: number, fileIdx: number) {
    const file = data.killerQuestions[killerIdx].solutionFiles[fileIdx]
    if (file?.path) {
      const { deleteSolutionFile } = await import('@/lib/db')
      await deleteSolutionFile(file.path)
    }
    setData((prev) => ({
      ...prev,
      killerQuestions: prev.killerQuestions.map((k, i) =>
        i === killerIdx ? { ...k, solutionFiles: k.solutionFiles.filter((_, fi) => fi !== fileIdx) } : k
      ),
    }))
  }

  function updateStrategy(idx: number, field: 'trend' | 'strategy', value: string) {
    setData((prev) => ({
      ...prev,
      strategies: prev.strategies.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }))
  }

  function updateKiller(idx: number, field: string, value: string | number) {
    setData((prev) => ({
      ...prev,
      killerQuestions: prev.killerQuestions.map((k, i) => i === idx ? { ...k, [field]: value } : k),
    }))
  }

  function addKiller() {
    setData((prev) => {
      if (prev.killerQuestions.length >= 5) return prev
      return {
        ...prev,
        killerQuestions: [...prev.killerQuestions, { number: 0, subUnit: '', intent: '', difficulty: '상', rate: 0, reason: '', solutionFiles: [] }],
      }
    })
  }

  function removeKiller(idx: number) {
    setData((prev) => ({ ...prev, killerQuestions: prev.killerQuestions.filter((_, i) => i !== idx) }))
  }

  const d = data
  const examTitle = `${d.examYear}년 ${d.school} ${d.grade} ${d.subject} ${d.examTerm}`

  async function handleSave() {
    if (!examDbId) return
    const { updateExamAnalysis } = await import('@/lib/db')
    await updateExamAnalysis(examDbId, { ...data, overallDifficulty, sectionComments, hitQuestions })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleFinalize() {
    if (!examDbId) return
    const missingSource = data.questions.filter((q) => !q.source || !q.source.trim() || q.source === '직접입력')
    if (missingSource.length > 0) {
      const nums = missingSource.map((q) => q.number).join(', ')
      alert(`출처가 입력되지 않은 문항이 ${missingSource.length}개 있습니다.\n문항 번호: ${nums}\n\n모든 문항의 출처를 입력한 뒤 다시 제출해 주세요.`)
      return
    }
    const { updateExamAnalysis, finalizeExam } = await import('@/lib/db')
    await updateExamAnalysis(examDbId, { ...data, overallDifficulty, sectionComments, hitQuestions })
    await finalizeExam(examDbId)
    setSaved(true)
    setExamStatus('제출 완료')
    alert(`"${examTitle}" 분석이 제출되었습니다.`)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePublish() {
    if (!examDbId) return
    const { updateExamAnalysis, publishExam } = await import('@/lib/db')
    await updateExamAnalysis(examDbId, { ...data, overallDifficulty, sectionComments, hitQuestions })
    await publishExam(examDbId, '')
    setExamStatus('발행 완료')
    alert(`"${examTitle}" 분석이 발행 처리되었습니다.`)
  }

  async function handleCopyText() {
    const sections: string[] = []
    sections.push(examTitle)
    sections.push('')
    if (sectionComments['examInfo']) sections.push(`시험 정보 코멘트: ${sectionComments['examInfo']}`)
    if (overallDifficulty) sections.push(`전체 난이도: ${overallDifficulty}`)
    if (sectionComments['overallDifficulty']) sections.push(`코멘트: ${sectionComments['overallDifficulty']}`)
    sections.push('')

    sections.push('[ 출제 현황 ]')
    data.questions.forEach((q) => {
      sections.push(`${q.number}번 | ${q.type} | ${q.mainUnit} ${q.subUnit} | 출처: ${q.source || '미입력'} | ${q.intent} | 정답률 ${q.expectedCorrectRate}% | ${q.difficulty} | 배점 ${q.score}`)
    })
    if (sectionComments['questions']) sections.push(`코멘트: ${sectionComments['questions']}`)
    sections.push('')

    if (sectionComments['diffChart']) sections.push(`난이도 분석 코멘트: ${sectionComments['diffChart']}`)
    if (sectionComments['sourceChart']) sections.push(`출처 분석 코멘트: ${sectionComments['sourceChart']}`)
    if (sectionComments['mainUnitChart']) sections.push(`대단원 분석 코멘트: ${sectionComments['mainUnitChart']}`)
    if (sectionComments['subUnitChart']) sections.push(`중단원 분석 코멘트: ${sectionComments['subUnitChart']}`)
    sections.push('')

    sections.push('[ 시험 총평 ]')
    sections.push('주요 특징:')
    data.keyFeatures.forEach((f) => sections.push(`• ${f}`))
    if (data.yearOverYearComparison) {
      sections.push('전년도 비교:')
      sections.push(data.yearOverYearComparison)
    }
    if (data.examSummary) {
      sections.push('종합 총평:')
      sections.push(data.examSummary)
    }
    if (data.commonMistakes.length > 0) {
      sections.push('학생 실수 포인트:')
      data.commonMistakes.forEach((m) => {
        sections.push(`• [${m.area}] ${m.description} → ${m.tip}`)
      })
    }
    if (sectionComments['overview']) sections.push(`코멘트: ${sectionComments['overview']}`)
    sections.push('')

    sections.push('[ 킬러문항 ]')
    data.killerQuestions.forEach((k) => {
      sections.push(`${k.number}번 | ${k.subUnit} | ${k.intent} | ${k.difficulty} | 정답률 ${k.rate}%`)
      sections.push(`  사유: ${k.reason}`)
    })
    if (sectionComments['killer']) sections.push(`코멘트: ${sectionComments['killer']}`)
    sections.push('')

    if (hitQuestions.length > 0) {
      sections.push('[ 적중문제 ]')
      hitQuestions.forEach((h) => {
        sections.push(`${h.questionNumber}번 | 출처: ${h.source}`)
      })
      if (sectionComments['hitQuestions']) sections.push(`코멘트: ${sectionComments['hitQuestions']}`)
      sections.push('')
    }

    sections.push('[ 다음 시험 전략 ]')
    data.strategies.forEach((s) => {
      sections.push(`출제경향: ${s.trend}`)
      sections.push(`전략: ${s.strategy}`)
      sections.push('')
    })
    if (sectionComments['strategy']) sections.push(`코멘트: ${sectionComments['strategy']}`)

    await navigator.clipboard.writeText(sections.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const isSourceSubject = SOURCE_SUBJECTS.includes(d.subject)
  const isMath = d.subject === '수학'
  const isSocial = d.subject === '사회'
  const barChartHeight = (count: number) => Math.max(180, count * 28)
  const diffData = getDiffData(d.questions)
  const subUnitData = getSubUnitData(d.questions)
  const sourceData = getSourceData(d.questions)
  const mainUnitData = getMainUnitData(d.questions)
  const intentData = getIntentData(d.questions)
  const activeDiffs = DIFFICULTY_ORDER.filter((diff) => d.questions.some((q) => q.difficulty === diff))

  const DiffLegend = () => (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
      {DIFFICULTY_ORDER.map((d) => (
        <div key={d} className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: DIFF_COLOR[d] }} />
          <span>{d}</span>
        </div>
      ))}
    </div>
  )

  const yAxisWidth = (rows: Record<string, unknown>[], key: string) => {
    const longest = rows.reduce((m, r) => Math.max(m, String(r[key] ?? '').length), 0)
    return Math.min(220, Math.max(56, longest * 10 + 16))
  }
  const stackedXMax = (rows: Record<string, unknown>[]) =>
    Math.max(1, ...rows.map((r) => activeDiffs.reduce((s, diff) => s + Number(r[diff] ?? 0), 0)))
  const stackedTicks = (max: number) => Array.from({ length: max + 1 }, (_, i) => i)

  const backLink = mode === 'admin' ? '/admin' : '/teacher'
  const statusColor = examStatus === '발행 완료' ? 'bg-green-100 text-green-700' : examStatus === '제출 완료' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'

  return (
    <div className="min-h-screen bg-gray-50">
      {copied && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          클립보드에 복사됐습니다!
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">품격에듀</span>
            {mode === 'admin' && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">관리자</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href={backLink} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              목록으로
            </Link>
            {mode !== 'teacher' && (
              <button onClick={handleCopyText}
                className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition">
                {copied ? '복사됨 ✓' : '텍스트 복사'}
              </button>
            )}
            <button onClick={handleSave}
              className="border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition">
              {saved ? '저장됨 ✓' : '임시 저장'}
            </button>
            {mode === 'teacher' && (
              <button onClick={handleFinalize}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                제출하기
              </button>
            )}
            {mode === 'admin' && examStatus !== '발행 완료' && (
              <button onClick={handlePublish}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                발행 처리
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {d.examYear}년 {d.school} {d.grade} {d.examTerm}
            </h1>
            {examStatus && <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}>{examStatus}</span>}
          </div>
          <p className="text-gray-500 text-sm">
            과목: {d.subject}
            {mode === 'admin' && teacherName && <> · {teacherName} 선생님 · {examDate}</>}
          </p>
        </div>

        {/* 시험 정보 + 출제 범위 */}
        {(examMeta.examScope.length > 0 || examMeta.teacherNote) && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📝 시험 정보</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {examMeta.examScope.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">출제 범위</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs w-24">구분</th>
                        <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examMeta.examScope.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 px-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{s.category}</span>
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-700">{s.detail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {examMeta.teacherNote && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">강사 메모</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-wrap">{examMeta.teacherNote}</p>
                </div>
              )}
            </div>
            <textarea value={sectionComments['examInfo'] ?? ''} onChange={(e) => updateSectionComment('examInfo', e.target.value)}
              placeholder="시험 정보에 대한 코멘트 (선택)" rows={2}
              className="w-full mt-4 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
          </section>
        )}

        {/* 전체 난이도 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📊 전체 난이도</h2>
          <div className="flex items-center gap-3">
            {DIFFICULTY_ORDER.map((diff) => (
              <button key={diff} type="button" onClick={() => setOverallDifficulty(diff)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition ${overallDifficulty === diff ? DIFF_BADGE[diff] + ' ring-2 ring-offset-1 ring-indigo-400' : 'bg-gray-100 text-gray-400'}`}>
                {diff}
              </button>
            ))}
          </div>
          <textarea value={data.aiDifficultyReason} onChange={(e) => setData((prev) => ({ ...prev, aiDifficultyReason: e.target.value }))}
            placeholder="AI 난이도 분석 근거를 수정할 수 있습니다" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y leading-relaxed" />
          <textarea value={sectionComments['overallDifficulty'] ?? ''} onChange={(e) => updateSectionComment('overallDifficulty', e.target.value)}
            placeholder="난이도에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
        </section>

        {/* ① 출제 현황 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 출제 현황</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    '문제', '유형', '출처',
                    ...(isSourceSubject ? ['영역'] : ['대단원', '중단원']),
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
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const preset = SOURCE_OPTIONS.slice(0, -1)
                          const isPreset = preset.includes(q.source)
                          const isCustom = q.source === '직접입력' || (q.source && !isPreset)
                          const dropValue = isPreset ? q.source : isCustom ? '직접입력' : ''
                          return (
                            <>
                              <select
                                value={dropValue}
                                onChange={(e) => updateQuestion(idx, 'source', e.target.value === '직접입력' ? '직접입력' : e.target.value)}
                                className={`text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${!q.source ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-gray-200'}`}>
                                <option value="">⚠ 선택</option>
                                {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                              </select>
                              {isCustom && (
                                <input
                                  value={q.source === '직접입력' ? '' : q.source}
                                  onChange={(e) => updateQuestion(idx, 'source', e.target.value || '직접입력')}
                                  placeholder="출처를 입력하세요"
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <input value={q.mainUnit} onChange={(e) => updateQuestion(idx, 'mainUnit', e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    {!isSourceSubject && (
                      <td className="py-2 px-3">
                        <input value={q.subUnit} onChange={(e) => updateQuestion(idx, 'subUnit', e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
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
                        {DIFFICULTY_ORDER.map((dd) => <option key={dd}>{dd}</option>)}
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
          <textarea value={sectionComments['questions'] ?? ''} onChange={(e) => updateSectionComment('questions', e.target.value)}
            placeholder="출제 현황에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
        </section>

        {/* ② 차트 4개 */}
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
            <textarea value={sectionComments['diffChart'] ?? ''} onChange={(e) => updateSectionComment('diffChart', e.target.value)}
              placeholder="난이도 분석에 대한 코멘트 (선택)" rows={2}
              className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📂 출처별 분석</h2>
            <ResponsiveContainer width="100%" height={barChartHeight(sourceData.length)}>
              <BarChart data={sourceData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, stackedXMax(sourceData as Record<string, unknown>[])]} ticks={stackedTicks(stackedXMax(sourceData as Record<string, unknown>[]))} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} width={yAxisWidth(sourceData as Record<string, unknown>[], 'source')} interval={0} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <DiffLegend />
            <textarea value={sectionComments['sourceChart'] ?? ''} onChange={(e) => updateSectionComment('sourceChart', e.target.value)}
              placeholder="출처 분석에 대한 코멘트 (선택)" rows={2}
              className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">{isMath ? '📚 대단원별 분석' : '📚 영역별 분석'}</h2>
            <ResponsiveContainer width="100%" height={barChartHeight(mainUnitData.length)}>
              <BarChart data={mainUnitData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, stackedXMax(mainUnitData as Record<string, unknown>[])]} ticks={stackedTicks(stackedXMax(mainUnitData as Record<string, unknown>[]))} />
                <YAxis type="category" dataKey="mainUnit" tick={{ fontSize: 10 }} width={yAxisWidth(mainUnitData as Record<string, unknown>[], 'mainUnit')} interval={0} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <DiffLegend />
            <textarea value={sectionComments['mainUnitChart'] ?? ''} onChange={(e) => updateSectionComment('mainUnitChart', e.target.value)}
              placeholder={isMath ? '대단원 분석에 대한 코멘트 (선택)' : '영역 분석에 대한 코멘트 (선택)'} rows={2}
              className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
          </section>

          {isSocial && (
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">📖 중단원별 분석</h2>
              <ResponsiveContainer width="100%" height={barChartHeight(subUnitData.length)}>
                <BarChart data={subUnitData as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, stackedXMax(subUnitData as Record<string, unknown>[])]} ticks={stackedTicks(stackedXMax(subUnitData as Record<string, unknown>[]))} />
                  <YAxis type="category" dataKey="subUnit" tick={{ fontSize: 10 }} width={yAxisWidth(subUnitData as Record<string, unknown>[], 'subUnit')} interval={0} />
                  <Tooltip />
                  {activeDiffs.map((diff) => (
                    <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <DiffLegend />
              <textarea value={sectionComments['socialSubUnitChart'] ?? ''} onChange={(e) => updateSectionComment('socialSubUnitChart', e.target.value)}
                placeholder="중단원 분석에 대한 코멘트 (선택)" rows={2}
                className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
            </section>
          )}

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">{isMath ? '📖 중단원별 분석' : '🎯 출제자 의도별 분석'}</h2>
            <ResponsiveContainer width="100%" height={barChartHeight((isMath ? subUnitData : intentData).length)}>
              <BarChart data={(isMath ? subUnitData : intentData) as Record<string, unknown>[]} layout="vertical" margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, stackedXMax((isMath ? subUnitData : intentData) as Record<string, unknown>[])]} ticks={stackedTicks(stackedXMax((isMath ? subUnitData : intentData) as Record<string, unknown>[]))} />
                <YAxis type="category" dataKey={isMath ? 'subUnit' : 'intent'} tick={{ fontSize: 10 }} width={yAxisWidth((isMath ? subUnitData : intentData) as Record<string, unknown>[], isMath ? 'subUnit' : 'intent')} interval={0} />
                <Tooltip />
                {activeDiffs.map((diff) => (
                  <Bar key={diff} dataKey={diff} stackId="a" fill={DIFF_COLOR[diff]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <DiffLegend />
            <textarea value={sectionComments['subUnitChart'] ?? ''} onChange={(e) => updateSectionComment('subUnitChart', e.target.value)}
              placeholder={isMath ? '중단원 분석에 대한 코멘트 (선택)' : '출제자 의도 분석에 대한 코멘트 (선택)'} rows={2}
              className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
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

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">종합 총평</h3>
            <textarea value={data.examSummary} onChange={(e) => updateExamSummary(e.target.value)}
              rows={4}
              placeholder="시험 전체에 대한 종합 총평을 작성하세요."
              className="text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-2 w-full leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">학생 실수 포인트</h3>
              <span className="text-xs text-gray-400">{data.commonMistakes.length}개</span>
            </div>
            <div className="space-y-3">
              {data.commonMistakes.map((m, i) => (
                <div key={i} className="bg-amber-50 rounded-xl p-4 relative">
                  <button onClick={() => removeCommonMistake(i)} title="삭제"
                    className="absolute top-3 right-3 w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 transition flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="space-y-2 pr-8">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">영역</span>
                      <input value={m.area} onChange={(e) => updateCommonMistake(i, 'area', e.target.value)}
                        placeholder="실수가 많은 영역/단원"
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-amber-600 whitespace-nowrap mt-1.5">설명</span>
                      <textarea value={m.description} onChange={(e) => updateCommonMistake(i, 'description', e.target.value)}
                        placeholder="학생들이 구체적으로 어떤 실수를 하는지"
                        rows={2}
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white resize-y leading-relaxed" />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-amber-600 whitespace-nowrap mt-1.5">팁</span>
                      <textarea value={m.tip} onChange={(e) => updateCommonMistake(i, 'tip', e.target.value)}
                        placeholder="실수 방지를 위한 구체적 팁"
                        rows={2}
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white resize-y leading-relaxed" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addCommonMistake} type="button"
                className="w-full border-2 border-dashed border-amber-200 rounded-xl py-3 text-sm text-amber-500 hover:bg-amber-50 hover:border-amber-300 transition">
                + 실수 포인트 추가
              </button>
            </div>
          </div>
          <textarea value={sectionComments['overview'] ?? ''} onChange={(e) => updateSectionComment('overview', e.target.value)}
            placeholder="시험 총평에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-4 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
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
              <div key={i} className="p-4 bg-red-50 rounded-xl">
              <div className="flex gap-4">
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
                      {DIFFICULTY_ORDER.map((dd) => <option key={dd}>{dd}</option>)}
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
                  <button onClick={() => solutionInputRefs.current[i]?.click()}
                    disabled={uploadingKillerIdx === i}
                    className="text-xs text-indigo-600 hover:underline whitespace-nowrap disabled:opacity-50">
                    {uploadingKillerIdx === i ? '업로드 중...' : '+ 손풀이'}
                  </button>
                  <input
                    ref={(el) => { solutionInputRefs.current[i] = el }}
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleSolutionUpload(i, e.target.files); e.target.value = '' }}
                  />
                </div>
              </div>
              {k.solutionFiles.length > 0 && (
                <div className="mt-2 ml-20 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {k.solutionFiles.map((f, fi) => {
                    const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(f.fileName)
                    return (
                      <div key={fi} className="relative bg-white rounded-lg border border-gray-200 overflow-hidden group">
                        {isImage ? (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.url} alt={f.fileName} className="w-full h-28 object-cover" />
                          </a>
                        ) : (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-28 bg-gray-50">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </a>
                        )}
                        <div className="px-2 py-1 text-[10px] text-gray-600 truncate border-t border-gray-100 bg-white">{f.fileName}</div>
                        <div className="absolute top-1 right-1 flex gap-1">
                          {mode !== 'teacher' && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer" download={f.fileName}
                              title="다운로드"
                              className="bg-white/90 hover:bg-white text-indigo-500 rounded-md p-1 shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                          )}
                          {mode === 'teacher' && (
                            <button onClick={() => removeSolutionFile(i, fi)} title="삭제"
                              className="bg-white/90 hover:bg-white text-gray-400 hover:text-red-500 rounded-md p-1 shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </div>
            )})}
            {data.killerQuestions.length < 5 && (
              <button onClick={addKiller} type="button"
                className="w-full border-2 border-dashed border-red-200 rounded-xl py-3 text-sm text-red-500 hover:bg-red-50 hover:border-red-300 transition">
                + 킬러문항 추가
              </button>
            )}
          </div>
          <textarea value={sectionComments['killer'] ?? ''} onChange={(e) => updateSectionComment('killer', e.target.value)}
            placeholder="킬러문항에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
        </section>

        {/* ⑥ 적중문제 */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">🎯 적중문제</h2>
            <span className="text-xs text-gray-400">{hitQuestions.length}개</span>
          </div>
          <div className="space-y-4">
            {hitQuestions.map((h, i) => (
              <div key={i} className="bg-green-50 rounded-xl p-4 relative">
                <button onClick={() => removeHitQuestion(i)} title="삭제"
                  className="absolute top-3 right-3 w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 transition flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="grid md:grid-cols-2 gap-4 pr-8">
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2">실제 시험문제</p>
                    <select value={h.questionNumber || ''} onChange={(e) => updateHitQuestion(i, 'questionNumber', Number(e.target.value))}
                      className="text-xs border border-green-200 rounded-lg px-2 py-1 bg-white mb-2 w-full focus:outline-none focus:ring-1 focus:ring-green-400">
                      <option value="">문제 번호 선택</option>
                      {data.questions.map((q) => <option key={q.number} value={q.number}>{q.number}번</option>)}
                    </select>
                    {h.examImage ? (
                      <div className="relative bg-white rounded-lg border border-green-200 overflow-hidden">
                        <img src={h.examImage.url} alt={h.examImage.fileName} className="w-full max-h-48 object-contain bg-gray-50" />
                        <div className="flex items-center justify-between px-3 py-1.5 border-t border-green-100">
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">{h.examImage.fileName}</span>
                          <div className="flex items-center gap-2">
                            {mode === 'admin' && (
                              <a href={h.examImage.url} download={h.examImage.fileName} title="다운로드" className="text-green-600 hover:text-green-800">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                              </a>
                            )}
                            {mode === 'teacher' && (
                              <>
                                <button onClick={() => { updateHitQuestion(i, 'examImage', null); hitExamInputRefs.current[i]?.click() }}
                                  title="다시 첨부" className="text-indigo-500 hover:text-indigo-700">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                                <button onClick={() => updateHitQuestion(i, 'examImage', null)}
                                  title="삭제" className="text-gray-400 hover:text-red-500">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => hitExamInputRefs.current[i]?.click()}
                        disabled={uploadingHitIdx?.idx === i && uploadingHitIdx?.side === 'examImage'}
                        className="w-full border-2 border-dashed border-green-200 rounded-lg py-6 text-xs text-green-500 hover:bg-green-100 transition">
                        {uploadingHitIdx?.idx === i && uploadingHitIdx?.side === 'examImage' ? '업로드 중...' : '+ 이미지 업로드'}
                      </button>
                    )}
                    <input ref={(el) => { hitExamInputRefs.current[i] = el }} type="file" accept="image/jpeg,.jpg,.jpeg" className="hidden"
                      onChange={(e) => { handleHitImageUpload(i, 'examImage', e.target.files); e.target.value = '' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2">적중문제</p>
                    <input value={h.source} onChange={(e) => updateHitQuestion(i, 'source', e.target.value)}
                      placeholder="출처 (예: EBS 수능특강 3강 5번)"
                      className="text-xs border border-green-200 rounded-lg px-2 py-1 bg-white mb-2 w-full focus:outline-none focus:ring-1 focus:ring-green-400" />
                    {h.hitImage ? (
                      <div className="relative bg-white rounded-lg border border-green-200 overflow-hidden">
                        <img src={h.hitImage.url} alt={h.hitImage.fileName} className="w-full max-h-48 object-contain bg-gray-50" />
                        <div className="flex items-center justify-between px-3 py-1.5 border-t border-green-100">
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">{h.hitImage.fileName}</span>
                          <div className="flex items-center gap-2">
                            {mode === 'admin' && (
                              <a href={h.hitImage.url} download={h.hitImage.fileName} title="다운로드" className="text-green-600 hover:text-green-800">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                              </a>
                            )}
                            {mode === 'teacher' && (
                              <>
                                <button onClick={() => { updateHitQuestion(i, 'hitImage', null); hitMatchInputRefs.current[i]?.click() }}
                                  title="다시 첨부" className="text-indigo-500 hover:text-indigo-700">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                                <button onClick={() => updateHitQuestion(i, 'hitImage', null)}
                                  title="삭제" className="text-gray-400 hover:text-red-500">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => hitMatchInputRefs.current[i]?.click()}
                        disabled={uploadingHitIdx?.idx === i && uploadingHitIdx?.side === 'hitImage'}
                        className="w-full border-2 border-dashed border-green-200 rounded-lg py-6 text-xs text-green-500 hover:bg-green-100 transition">
                        {uploadingHitIdx?.idx === i && uploadingHitIdx?.side === 'hitImage' ? '업로드 중...' : '+ 이미지 업로드'}
                      </button>
                    )}
                    <input ref={(el) => { hitMatchInputRefs.current[i] = el }} type="file" accept="image/jpeg,.jpg,.jpeg" className="hidden"
                      onChange={(e) => { handleHitImageUpload(i, 'hitImage', e.target.files); e.target.value = '' }} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addHitQuestion} type="button"
              className="w-full border-2 border-dashed border-green-200 rounded-xl py-3 text-sm text-green-500 hover:bg-green-50 hover:border-green-300 transition">
              + 적중문제 추가
            </button>
          </div>
          <textarea value={sectionComments['hitQuestions'] ?? ''} onChange={(e) => updateSectionComment('hitQuestions', e.target.value)}
            placeholder="적중문제에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
        </section>

        {/* ⑦ 다음 시험 전략 */}
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
          <textarea value={sectionComments['strategy'] ?? ''} onChange={(e) => updateSectionComment('strategy', e.target.value)}
            placeholder="전략에 대한 코멘트 (선택)" rows={2}
            className="w-full mt-3 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y" />
        </section>

        {/* 하단 버튼 */}
        <div className="flex flex-col items-end gap-2 pb-8">
          <p className="text-xs text-gray-400">저장 제목: {examTitle}</p>
          <div className="flex gap-3">
            {mode !== 'teacher' && (
              <button onClick={handleCopyText}
                className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
                {copied ? '복사됨 ✓' : '텍스트 복사'}
              </button>
            )}
            <button onClick={handleSave}
              className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
              {saved ? '저장됨 ✓' : '임시 저장'}
            </button>
            {mode === 'teacher' && (
              <button onClick={handleFinalize}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition">
                제출하기
              </button>
            )}
            {mode === 'admin' && examStatus !== '발행 완료' && (
              <button onClick={handlePublish}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl text-sm transition">
                발행 처리
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ExamAnalysis(props: ExamAnalysisProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">불러오는 중...</div>}>
      <ExamAnalysisContent {...props} />
    </Suspense>
  )
}
