'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Subject } from '@/lib/types'

const SUBJECT_STYLE: Record<string, string> = {
  국어: 'bg-blue-100 text-blue-700',
  영어: 'bg-green-100 text-green-700',
  수학: 'bg-red-100 text-red-700',
  사회: 'bg-orange-100 text-orange-700',
}

const SUBJECTS: Subject[] = ['국어', '영어', '수학', '사회']

interface ExamRecord {
  id: string
  title: string
  subject: string
  grade: string
  school: string
  examYear: number
  examTerm: string
  isFinalized: boolean
  createdAt: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<ExamRecord[]>([])
  const [currentUser, setCurrentUser] = useState<{ userId: string; subject: Subject } | null>(null)
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [newSubject, setNewSubject] = useState<Subject | ''>('')
  const [changeRequested, setChangeRequested] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('examList')
    if (stored) {
      try { setExams(JSON.parse(stored)) } catch { /* ignore */ }
    }
    const user = localStorage.getItem('currentUser')
    if (user) {
      try { setCurrentUser(JSON.parse(user)) } catch { /* ignore */ }
    }
  }, [])

  function handleSubjectChangeRequest() {
    if (!newSubject || !currentUser) return
    const requests = JSON.parse(localStorage.getItem('subjectChangeRequests') ?? '[]')
    requests.unshift({
      id: `scr_${Date.now()}`,
      userId: currentUser.userId,
      currentSubject: currentUser.subject,
      requestedSubject: newSubject,
      requestedAt: new Date().toISOString().slice(0, 10),
      status: 'pending',
    })
    localStorage.setItem('subjectChangeRequests', JSON.stringify(requests))
    setShowChangeModal(false)
    setNewSubject('')
    setChangeRequested(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">품격에듀</span>
          </div>
          <div className="flex items-center gap-4">
            {currentUser?.subject && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SUBJECT_STYLE[currentUser.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                  {currentUser.subject}
                </span>
                <button
                  onClick={() => { setShowChangeModal(true); setChangeRequested(false) }}
                  className="text-xs text-gray-400 hover:text-indigo-600 transition underline underline-offset-2"
                >
                  과목 변경 신청
                </button>
              </div>
            )}
            <span className="text-sm text-gray-500">{currentUser?.userId ?? '강사'}</span>
            <button
              onClick={() => { localStorage.removeItem('currentUser'); router.push('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 상단 타이틀 + 업로드 버튼 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">시험 분석 목록</h1>
            <p className="text-gray-500 text-sm mt-1">시험지를 업로드하여 AI 분석을 시작하세요</p>
          </div>
          <Link
            href="/teacher/upload"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 시험 분석
          </Link>
        </div>

        {/* 시험 목록 */}
        {exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">아직 분석한 시험지가 없습니다</p>
            <Link href="/teacher/upload" className="inline-block mt-4 text-indigo-600 text-sm font-medium hover:underline">
              첫 시험지 업로드하기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/teacher/analysis/${exam.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 hover:border-indigo-300 hover:shadow-sm transition group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${SUBJECT_STYLE[exam.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                    {exam.subject}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {exam.title || `${exam.examYear}년 ${exam.school} ${exam.grade} ${exam.subject} ${exam.examTerm}`}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{exam.createdAt} 분석</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    exam.isFinalized
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {exam.isFinalized ? '수정 완료' : '수정 중'}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 담당과목 변경 신청 모달 */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">담당 과목 변경 신청</h3>
            <p className="text-xs text-gray-400 mb-5">관리자 승인 후 변경됩니다.</p>
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-1">현재 과목</p>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${SUBJECT_STYLE[currentUser?.subject ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                {currentUser?.subject}
              </span>
            </div>
            <div className="mt-4 mb-5">
              <label className="text-xs text-gray-500 block mb-1.5">변경할 과목</label>
              <div className="flex gap-2 flex-wrap">
                {SUBJECTS.filter((s) => s !== currentUser?.subject).map((s) => (
                  <button key={s} type="button"
                    onClick={() => setNewSubject(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                      newSubject === s
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {changeRequested && (
              <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-xl mb-4">
                변경 신청이 완료됐습니다. 관리자 승인을 기다려주세요.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowChangeModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">
                취소
              </button>
              <button onClick={handleSubjectChangeRequest} disabled={!newSubject}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition">
                신청
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
