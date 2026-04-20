'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Subject, Grade, Difficulty, ExamScopeItem, SourceCategory } from '@/lib/types'
import { createExam, getRecentAnalysisCount } from '@/lib/db'
import { supabase } from '@/lib/supabase'

const GRADES: Grade[] = ['중1', '중2', '중3', '고1', '고2', '고3']
const TERMS = ['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사', '모의고사']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const DIFFICULTIES: Difficulty[] = ['상', '중상', '중', '중하', '하']
const SCOPE_CATEGORIES: SourceCategory[] = ['교과서', '부교재', '모의고사', '학습지']

function scopePlaceholder(cat: SourceCategory): string {
  switch (cat) {
    case '교과서': return '예: 미래엔 1~3단원'
    case '부교재': return '예: EBS 수능특강 1~3강'
    case '모의고사': return '예: 26년 3월 모의고사 1,5,7번'
    case '학습지': return '예: 5월 1~3주차'
    default: return ''
  }
}

export default function UploadPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    subject: '' as Subject | '',
    grade: '' as Grade | '',
    school: '',
    examYear: String(CURRENT_YEAR),
    examTerm: '',
    expectedDifficulty: '중' as Difficulty,
    teacherNote: '',
  })

  const [examScope, setExamScope] = useState<ExamScopeItem[]>([])

  function addScopeRow() {
    setExamScope((prev) => [...prev, { category: '교과서', detail: '' }])
  }
  function updateScopeRow(idx: number, field: 'category' | 'detail', value: string) {
    setExamScope((prev) => prev.map((row, i) =>
      i === idx ? { ...row, [field]: field === 'category' ? value as SourceCategory : value } : row
    ))
  }
  function removeScopeRow(idx: number) {
    setExamScope((prev) => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}')
    if (user.subject) {
      setForm((prev) => ({ ...prev, subject: user.subject }))
    }
    if (user.id) {
      getRecentAnalysisCount(user.id).then(setAnalysisQuota)
    }
  }, [])

  const [currentImages, setCurrentImages] = useState<File[]>([])
  const [prevImages, setPrevImages] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysisQuota, setAnalysisQuota] = useState<{ used: number; limit: number; periodStart: string; periodEnd: string } | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const currentInputRef = useRef<HTMLInputElement>(null)
  const prevInputRef = useRef<HTMLInputElement>(null)

  function compressImage(file: File, maxSize = 1600): Promise<File> {
    if (file.type === 'application/pdf') return Promise.resolve(file)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
        }, 'image/jpeg', 0.8)
      }
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCurrentImages(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? [])
    const remaining = Math.max(0, 10 - currentImages.length)
    const files = incoming.slice(0, remaining)
    const compressed = await Promise.all(files.map((f) => compressImage(f)))
    setCurrentImages((prev) => [...prev, ...compressed])
  }

  async function handlePrevImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3)
    const compressed = await Promise.all(files.map((f) => compressImage(f)))
    setPrevImages(compressed)
  }

  function removeCurrentImage(idx: number) {
    setCurrentImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function removePrevImage(idx: number) {
    setPrevImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (!form.subject || !form.grade || !form.school || !form.examTerm) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    if (currentImages.length === 0) {
      setError('분석할 시험지를 업로드해주세요.')
      return
    }

    if (analysisQuota && analysisQuota.used >= analysisQuota.limit) {
      setError(`주간 분석 가능 횟수(${analysisQuota.limit}회)를 초과했습니다. 관리자에게 문의하세요.`)
      return
    }

    setShowConfirmModal(true)
  }

  async function handleConfirmAnalysis() {
    setShowConfirmModal(false)
    setLoading(true)

    try {
      async function uploadToStorage(file: File, folder: string): Promise<string> {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('exam-files').upload(path, file, { upsert: true })
        if (error) throw new Error(`업로드 실패: ${error.message}`)
        const { data } = supabase.storage.from('exam-files').getPublicUrl(path)
        return data.publicUrl
      }

      const currentImageUrls: string[] = []
      for (const f of currentImages) {
        currentImageUrls.push(await uploadToStorage(f, 'temp-exams'))
      }
      const prevImageUrls: string[] = []
      for (const f of prevImages) {
        prevImageUrls.push(await uploadToStorage(f, 'temp-exams'))
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject,
          grade: form.grade,
          school: form.school,
          examYear: form.examYear,
          examTerm: form.examTerm,
          expectedDifficulty: form.expectedDifficulty,
          teacherNote: form.teacherNote || undefined,
          examScope: examScope.length > 0 ? JSON.stringify(examScope) : undefined,
          currentImageUrls,
          prevImageUrls,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        setError(error || '분석 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      const analysis = await res.json()

      const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}')
      const result = await createExam({
        teacher_id: user.id,
        subject: form.subject,
        grade: form.grade,
        school: form.school,
        exam_year: Number(form.examYear),
        exam_term: form.examTerm,
        exam_scope: examScope,
        expected_difficulty: form.expectedDifficulty,
        teacher_note: form.teacherNote,
        analysis,
      })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      setLoading(false)
      router.push(`/teacher/analysis/${result.id}`)
    } catch {
      setError('서버 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
      return
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">품격에듀</span>
          </div>
          <Link href="/teacher" className="text-sm text-gray-400 hover:text-gray-600 transition flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">새 시험 분석</h1>
          <p className="text-gray-500 text-sm mt-1">시험지 정보를 입력하고 이미지를 업로드하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 시험 정보 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">시험 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">과목</label>
                <div className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 flex items-center justify-between">
                  <span className="font-medium">{form.subject || '—'}</span>
                  <span className="text-xs text-gray-400">담당 과목 고정</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학년</label>
                <select name="grade" value={form.grade} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                  <option value="">학년 선택</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학교명</label>
                <input name="school" value={form.school} onChange={handleChange}
                  placeholder="예: ○○고등학교"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">시험 연도</label>
                <select name="examYear" value={form.examYear} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                  {YEARS.map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">시험 종류</label>
                <select name="examTerm" value={form.examTerm} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                  <option value="">종류 선택</option>
                  {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 시험 범위 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">시험 범위</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">선택</span>
            </div>
            <p className="text-xs text-gray-400 mb-5">출제 범위를 입력하면 AI 분석 정확도가 높아집니다</p>

            <div className="space-y-3 mb-3">
              {examScope.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={row.category}
                    onChange={(e) => updateScopeRow(i, 'category', e.target.value)}
                    className="w-28 shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    {SCOPE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    value={row.detail}
                    onChange={(e) => updateScopeRow(i, 'detail', e.target.value)}
                    placeholder={scopePlaceholder(row.category)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button type="button" onClick={() => removeScopeRow(i)}
                    className="text-gray-400 hover:text-red-500 transition shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addScopeRow}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-center hover:border-indigo-300 hover:bg-indigo-50 transition">
              <p className="text-sm text-gray-400">+ 범위 추가</p>
            </button>
          </div>

          {/* 예상 난이도 + 메모 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">예상 난이도 · 메모</h2>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">예상 난이도</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, expectedDifficulty: d }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                      form.expectedDifficulty === d
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">강사 메모</label>
              <textarea
                name="teacherNote"
                value={form.teacherNote}
                onChange={(e) => setForm((prev) => ({ ...prev, teacherNote: e.target.value }))}
                placeholder="시험 특이사항이나 AI 분석에 참고할 내용을 입력하세요 (선택)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              />
            </div>
          </div>

          {/* 분석할 시험지 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">분석할 시험지</h2>
              <span className="text-xs text-gray-400">최대 10장 ({currentImages.length}/10)</span>
            </div>
            <p className="text-xs text-gray-400 mb-5">AI가 분석할 시험지 이미지를 순서대로 업로드하세요 (JPG, PNG, PDF)</p>

            {currentImages.length === 0 ? (
              <button type="button" onClick={() => currentInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-10 text-center hover:border-indigo-300 hover:bg-indigo-50 transition">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-400">클릭하여 업로드</p>
              </button>
            ) : (
              <div className="space-y-2">
                {currentImages.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-indigo-500 w-6">{i + 1}.</span>
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate max-w-xs">{file.name}</span>
                    </div>
                    <button type="button" onClick={() => removeCurrentImage(i)}
                      className="text-gray-400 hover:text-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {currentImages.length < 10 && (
                  <button type="button" onClick={() => currentInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-center text-sm text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 transition">
                    + 추가 업로드 ({currentImages.length}/10)
                  </button>
                )}
              </div>
            )}
            <input ref={currentInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleCurrentImages} className="hidden" />
          </div>

          {/* 비교할 전년도 시험지 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">전년도 시험지</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">선택</span>
              </div>
              <span className="text-xs text-gray-400">최대 3개</span>
            </div>
            <p className="text-xs text-gray-400 mb-5">비교 분석을 원하면 전년도 시험지를 함께 업로드하세요</p>

            <div className="space-y-2 mb-3">
              {prevImages.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate max-w-xs">{file.name}</span>
                  </div>
                  <button type="button" onClick={() => removePrevImage(i)}
                    className="text-gray-400 hover:text-red-500 transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {prevImages.length < 3 && (
              <button type="button" onClick={() => prevInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-center hover:border-gray-300 hover:bg-gray-50 transition">
                <p className="text-sm text-gray-400">+ 전년도 시험지 추가</p>
              </button>
            )}
            <input ref={prevInputRef} type="file" accept="image/*,.pdf" multiple onChange={handlePrevImages} className="hidden" />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          {analysisQuota && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm ${analysisQuota.used >= analysisQuota.limit ? 'bg-red-50 border border-red-200' : 'bg-indigo-50 border border-indigo-200'}`}>
              <span className={analysisQuota.used >= analysisQuota.limit ? 'text-red-700' : 'text-indigo-700'}>
                주간 분석 횟수: <strong>{analysisQuota.used}</strong> / {analysisQuota.limit}회
                <span className="text-xs ml-2 opacity-70">({analysisQuota.periodStart} ~ {analysisQuota.periodEnd})</span>
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${analysisQuota.used >= analysisQuota.limit ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {analysisQuota.used >= analysisQuota.limit ? '초과' : `남은 횟수: ${analysisQuota.limit - analysisQuota.used}회`}
              </span>
            </div>
          )}

          <button type="submit" disabled={loading || (analysisQuota !== null && analysisQuota.used >= analysisQuota.limit)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-4 rounded-xl transition flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                AI 분석 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 분석 시작
              </>
            )}
          </button>
        </form>
      </main>

      {showConfirmModal && analysisQuota && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">분석을 시작하시겠습니까?</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">기간</span>
                <span className="text-gray-900 font-medium">{analysisQuota.periodStart} ~ {analysisQuota.periodEnd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">제한 횟수</span>
                <span className="text-gray-900 font-medium">{analysisQuota.limit}회</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">사용 횟수</span>
                <span className="text-gray-900 font-medium">{analysisQuota.used}회</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-500">남은 횟수</span>
                <span className="text-indigo-600 font-bold">{analysisQuota.limit - analysisQuota.used}회</span>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-4">
              분석을 시작하면 1회가 차감됩니다. 시험지가 정확히 업로드되었는지 확인해주세요.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
              <button onClick={handleConfirmAnalysis}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition">분석 시작</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
