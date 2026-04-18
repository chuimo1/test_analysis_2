'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Subject } from '@/lib/types'
import { getExams, updateUserProfile } from '@/lib/db'

const SUBJECT_STYLE: Record<string, string> = {
  국어: 'bg-blue-100 text-blue-700',
  영어: 'bg-green-100 text-green-700',
  수학: 'bg-red-100 text-red-700',
  사회: 'bg-orange-100 text-orange-700',
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function TeacherDashboard() {
  const router = useRouter()
  const [exams, setExams] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; userId: string; name: string; subject: Subject; phone?: string } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileForm, setProfileForm] = useState({ phone: '', password: '', passwordConfirm: '' })
  const [profileMsg, setProfileMsg] = useState('')

  useEffect(() => {
    const user = localStorage.getItem('currentUser')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        setCurrentUser(parsed)
        setProfileForm((prev) => ({ ...prev, phone: parsed.phone ?? '' }))
        getExams(parsed.id).then(setExams)
      } catch { /* ignore */ }
    }
  }, [])

  async function handleProfileSave() {
    if (!currentUser) return
    setProfileMsg('')

    if (profileForm.password && profileForm.password.length < 8) {
      setProfileMsg('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (profileForm.password && profileForm.password !== profileForm.passwordConfirm) {
      setProfileMsg('비밀번호가 일치하지 않습니다.')
      return
    }

    const update: { phone?: string; password?: string } = {}
    if (profileForm.phone) update.phone = profileForm.phone
    if (profileForm.password) update.password = profileForm.password

    await updateUserProfile(currentUser.id, update)

    if (update.phone) {
      const stored = JSON.parse(localStorage.getItem('currentUser') ?? '{}')
      stored.phone = update.phone
      localStorage.setItem('currentUser', JSON.stringify(stored))
    }

    setProfileMsg('저장되었습니다.')
    setProfileForm((prev) => ({ ...prev, password: '', passwordConfirm: '' }))
    setTimeout(() => setProfileMsg(''), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SUBJECT_STYLE[currentUser.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                {currentUser.subject}
              </span>
            )}
            <button onClick={() => setShowProfileModal(true)}
              className="text-xs text-gray-400 hover:text-indigo-600 transition underline underline-offset-2">
              개인정보 수정
            </button>
            <span className="text-sm text-gray-500">{currentUser?.name ?? '강사'}</span>
            <button onClick={() => { localStorage.removeItem('currentUser'); router.push('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600 transition">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">시험 분석 목록</h1>
            <p className="text-gray-500 text-sm mt-1">시험지를 업로드하여 AI 분석을 시작하세요</p>
          </div>
          <Link href="/teacher/upload"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-5 rounded-xl transition text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 시험 분석
          </Link>
        </div>

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
              <Link key={exam.id} href={`/teacher/analysis/${exam.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 hover:border-indigo-300 hover:shadow-sm transition group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${SUBJECT_STYLE[exam.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                    {exam.subject}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {`${exam.exam_year}년 ${exam.school} ${exam.grade} ${exam.subject} ${exam.exam_term}`}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{exam.created_at?.slice(0, 10)} 분석</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${exam.is_finalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {exam.is_finalized ? '제출 완료' : '수정 중'}
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

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">개인정보 수정</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">연락처</label>
                <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">새 비밀번호</label>
                <input type="password" value={profileForm.password} onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  placeholder="변경 시에만 입력 (8자 이상)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">비밀번호 확인</label>
                <input type="password" value={profileForm.passwordConfirm} onChange={(e) => setProfileForm({ ...profileForm, passwordConfirm: e.target.value })}
                  placeholder="비밀번호 재입력"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {profileMsg && (
                <p className={`text-xs px-3 py-2 rounded-xl ${profileMsg.includes('저장') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>{profileMsg}</p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowProfileModal(false); setProfileMsg('') }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">취소</button>
              <button onClick={handleProfileSave}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
