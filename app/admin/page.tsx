'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Subject, SubjectChangeRequest, User } from '@/lib/types'

interface ExamRecord {
  id: string
  teacherName?: string
  teacherId?: string
  title?: string
  subject: string
  grade: string
  school: string
  examYear: number
  examTerm: string
  isFinalized: boolean
  blogPublishedAt?: string
  createdAt: string
}

interface PendingSignup {
  id: string
  userId: string
  name: string
  phone: string
  subject: Subject
  appliedAt: string
}

const SUBJECT_STYLE: Record<string, string> = {
  국어: 'bg-blue-100 text-blue-700',
  영어: 'bg-green-100 text-green-700',
  수학: 'bg-red-100 text-red-700',
  사회: 'bg-orange-100 text-orange-700',
}

type Tab = 'posts' | 'pending' | 'subject' | 'teachers'
type PostStatus = 'waiting' | 'editing' | 'published'

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('posts')
  const [postStatus, setPostStatus] = useState<PostStatus>('waiting')

  const [exams, setExams] = useState<ExamRecord[]>([])
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([])
  const [subjectRequests, setSubjectRequests] = useState<SubjectChangeRequest[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [filter, setFilter] = useState({ school: '', grade: '', subject: '', examYear: '', examTerm: '' })

  useEffect(() => {
    const read = <T,>(key: string, fallback: T): T => {
      try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return fallback }
    }
    setExams(read<ExamRecord[]>('examList', []))
    setPendingSignups(read<PendingSignup[]>('pendingSignups', []))
    setSubjectRequests(read<SubjectChangeRequest[]>('subjectChangeRequests', []))
    setUsers(read<User[]>('users', []))
  }, [])

  function persist<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function approveSignup(id: string) {
    const target = pendingSignups.find((p) => p.id === id)
    if (!target) return
    const nextPending = pendingSignups.filter((p) => p.id !== id)
    const newUser: User = {
      id: `u_${Date.now()}`,
      userId: target.userId,
      name: target.name,
      phone: target.phone,
      role: 'teacher',
      subject: target.subject,
      isApproved: true,
      isActive: true,
      firstLoginCompleted: false,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const nextUsers = [...users, newUser]
    setPendingSignups(nextPending); setUsers(nextUsers)
    persist('pendingSignups', nextPending); persist('users', nextUsers)
  }

  function rejectSignup(id: string) {
    const next = pendingSignups.filter((p) => p.id !== id)
    setPendingSignups(next); persist('pendingSignups', next)
  }

  function processSubjectRequest(id: string, approve: boolean) {
    const target = subjectRequests.find((r) => r.id === id)
    if (!target) return
    const nextRequests = subjectRequests.map((r) =>
      r.id === id ? { ...r, status: approve ? 'approved' as const : 'rejected' as const } : r,
    )
    setSubjectRequests(nextRequests); persist('subjectChangeRequests', nextRequests)

    if (approve) {
      const nextUsers = users.map((u) =>
        u.userId === target.userId ? { ...u, subject: target.requestedSubject } : u,
      )
      setUsers(nextUsers); persist('users', nextUsers)
    }
  }

  function toggleActive(userId: string) {
    const next = users.map((u) => u.userId === userId ? { ...u, isActive: !u.isActive } : u)
    setUsers(next); persist('users', next)
  }

  const filteredExams = exams.filter((e) => {
    if (filter.school && !e.school.includes(filter.school)) return false
    if (filter.grade && e.grade !== filter.grade) return false
    if (filter.subject && e.subject !== filter.subject) return false
    if (filter.examYear && String(e.examYear) !== filter.examYear) return false
    if (filter.examTerm && e.examTerm !== filter.examTerm) return false
    return true
  })

  const waiting = filteredExams.filter((e) => e.isFinalized && !e.blogPublishedAt)
  const editing = filteredExams.filter((e) => !e.isFinalized)
  const published = filteredExams.filter((e) => e.isFinalized && e.blogPublishedAt)
  const currentList = postStatus === 'waiting' ? waiting : postStatus === 'editing' ? editing : published
  const pendingSubjectRequests = subjectRequests.filter((r) => r.status === 'pending')

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
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">관리자</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">실장</span>
            <button onClick={() => router.push('/login')} className="text-sm text-gray-400 hover:text-gray-600 transition">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {([
            ['posts', '시험 분석 목록', waiting.length],
            ['pending', '가입 승인', pendingSignups.length],
            ['subject', '과목 변경', pendingSubjectRequests.length],
            ['teachers', '강사 관리', 0],
          ] as const).map(([key, label, badge]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
              {badge > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'posts' && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {([
                ['waiting', `🔴 발행 대기 (${waiting.length})`],
                ['editing', `🟡 수정 중 (${editing.length})`],
                ['published', `✅ 발행 완료 (${published.length})`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPostStatus(key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${postStatus === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
              <input placeholder="학교명" value={filter.school} onChange={(e) => setFilter({ ...filter, school: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs w-32" />
              <select value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                <option value="">전체학년</option>
                {['중1','중2','중3','고1','고2','고3'].map((g) => <option key={g}>{g}</option>)}
              </select>
              <select value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                <option value="">전체과목</option>
                {['국어','영어','수학','사회'].map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={filter.examYear} onChange={(e) => setFilter({ ...filter, examYear: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                <option value="">전체연도</option>
                {[2026, 2025, 2024, 2023, 2022].map((y) => <option key={y}>{y}</option>)}
              </select>
              <select value={filter.examTerm} onChange={(e) => setFilter({ ...filter, examTerm: e.target.value })}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                <option value="">전체종류</option>
                {['1학기 중간고사','1학기 기말고사','2학기 중간고사','2학기 기말고사','모의고사'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            {currentList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-sm">해당 상태의 분석이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentList.map((p) => {
                  const canOpen = p.isFinalized
                  const Inner = (
                    <div className={`flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 ${canOpen ? 'hover:border-indigo-300 hover:shadow-sm group' : 'opacity-60'} transition`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${SUBJECT_STYLE[p.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                          {p.subject}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {p.title || `${p.school} · ${p.grade} ${p.examYear}년 ${p.examTerm}`}
                          </p>
                          <p className="text-gray-400 text-xs mt-0.5">{p.teacherName ?? '—'} · {p.createdAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {postStatus === 'waiting' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">발행 대기</span>}
                        {postStatus === 'editing' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">수정 중</span>}
                        {postStatus === 'published' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">발행 완료</span>}
                      </div>
                    </div>
                  )
                  return canOpen ? <Link key={p.id} href={`/admin/post/${p.id}`}>{Inner}</Link> : <div key={p.id}>{Inner}</div>
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'pending' && (
          <div>
            {pendingSignups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-sm">대기 중인 가입 신청이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSignups.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-bold text-sm">
                        {p.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {p.name}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${SUBJECT_STYLE[p.subject] ?? 'bg-gray-100 text-gray-700'}`}>{p.subject}</span>
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{p.userId} · {p.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => rejectSignup(p.id)}
                        className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition">거절</button>
                      <button onClick={() => approveSignup(p.id)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition">승인</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'subject' && (
          <div>
            {pendingSubjectRequests.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-sm">대기 중인 과목 변경 신청이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSubjectRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{r.userId}</p>
                        <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full ${SUBJECT_STYLE[r.currentSubject]}`}>{r.currentSubject}</span>
                          <span>→</span>
                          <span className={`px-2 py-0.5 rounded-full ${SUBJECT_STYLE[r.requestedSubject]}`}>{r.requestedSubject}</span>
                          <span className="ml-2">{r.requestedAt}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => processSubjectRequest(r.id, false)}
                        className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition">거절</button>
                      <button onClick={() => processSubjectRequest(r.id, true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition">승인</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'teachers' && (
          <div>
            {users.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-sm">등록된 강사가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.filter((u) => u.role === 'teacher').map((u) => (
                  <div key={u.id} className={`flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 ${!u.isActive ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-bold text-sm">
                        {u.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm flex items-center gap-2">
                          {u.name}
                          {u.subject && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${SUBJECT_STYLE[u.subject]}`}>{u.subject}</span>
                          )}
                          {!u.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">비활성</span>}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{u.userId} · {u.phone || '전화번호 없음'} · 가입일 {u.createdAt}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleActive(u.userId)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition ${u.isActive ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                      {u.isActive ? '비활성화' : '재활성화'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
