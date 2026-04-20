'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getPendingSignups, approveUser, rejectUser,
  getTeachers, toggleUserActive, deleteUser, resetUserPassword,
  resetAnalysisCount, getExams, getApiKeyStatus,
} from '@/lib/db'

const SUBJECT_STYLE: Record<string, string> = {
  국어: 'bg-blue-100 text-blue-700',
  영어: 'bg-green-100 text-green-700',
  수학: 'bg-red-100 text-red-700',
  사회: 'bg-orange-100 text-orange-700',
}

type Tab = 'posts' | 'pending' | 'teachers'
type PostStatus = 'waiting' | 'editing' | 'published'

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('posts')
  const [postStatus, setPostStatus] = useState<PostStatus>('waiting')

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [exams, setExams] = useState<any[]>([])
  const [pendingSignups, setPendingSignups] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [apiKeyStatus, setApiKeyStatus] = useState<{ key_index: number; last_used_at: string | null; last_quota_error_at: string | null }[]>([])

  const [filter, setFilter] = useState({ school: '', grade: '', subject: '', examYear: '', examTerm: '' })

  const loadData = useCallback(async () => {
    const [e, p, t, k] = await Promise.all([
      getExams(),
      getPendingSignups(),
      getTeachers(),
      getApiKeyStatus(),
    ])
    setExams(e)
    setPendingSignups(p)
    setTeachers(t)
    setApiKeyStatus(k)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleApprove(id: string) {
    await approveUser(id)
    loadData()
  }

  async function handleReject(id: string) {
    await rejectUser(id)
    loadData()
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await toggleUserActive(id, !currentActive)
    loadData()
  }

  async function handleDeleteUser(id: string, name: string) {
    if (!confirm(`"${name}" 강사 계정을 삭제하시겠습니까? 해당 강사의 모든 시험 분석 데이터도 삭제됩니다.`)) return
    await deleteUser(id)
    loadData()
  }

  async function handleResetPassword(id: string, name: string) {
    if (!confirm(`"${name}" 강사의 비밀번호를 초기화(00000000)하시겠습니까?`)) return
    await resetUserPassword(id)
    alert(`${name} 강사의 비밀번호가 00000000으로 초기화되었습니다.`)
  }

  async function handleResetAnalysisCount(id: string, name: string) {
    if (!confirm(`"${name}" 강사의 분석 횟수를 초기화하시겠습니까?`)) return
    await resetAnalysisCount(id)
    alert(`${name} 강사의 분석 횟수가 초기화되었습니다.`)
  }

  const filteredExams = exams.filter((e) => {
    if (filter.school && !e.school.includes(filter.school)) return false
    if (filter.grade && e.grade !== filter.grade) return false
    if (filter.subject && e.subject !== filter.subject) return false
    if (filter.examYear && String(e.exam_year) !== filter.examYear) return false
    if (filter.examTerm && e.exam_term !== filter.examTerm) return false
    return true
  })

  const waiting = filteredExams.filter((e) => e.is_finalized && !e.blog_published_at)
  const editing = filteredExams.filter((e) => !e.is_finalized)
  const published = filteredExams.filter((e) => e.is_finalized && e.blog_published_at)
  const currentList = postStatus === 'waiting' ? waiting : postStatus === 'editing' ? editing : published

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
            <button onClick={() => { localStorage.removeItem('currentUser'); router.push('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600 transition">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {([
            ['posts', '시험 분석 목록', waiting.length],
            ['pending', '가입 승인', pendingSignups.length],
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
                ['waiting', `🔴 제출 완료 (${waiting.length})`],
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
                {[2026,2025,2024,2023,2022].map((y) => <option key={y}>{y}</option>)}
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
                  const teacherName = p.users?.name ?? '—'
                  return (
                    <Link key={p.id} href={`/admin/post/${p.id}`}>
                      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 hover:border-indigo-300 hover:shadow-sm transition">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${SUBJECT_STYLE[p.subject] ?? 'bg-gray-100 text-gray-700'}`}>
                            {p.subject}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {p.school} · {p.grade} {p.exam_year}년 {p.exam_term}
                            </p>
                            <p className="text-gray-400 text-xs mt-0.5">{teacherName} 선생님 · {p.created_at?.slice(0, 10)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {postStatus === 'waiting' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-100 text-red-700">제출 완료</span>}
                          {postStatus === 'editing' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">수정 중</span>}
                          {postStatus === 'published' && <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">발행 완료</span>}
                        </div>
                      </div>
                    </Link>
                  )
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
                        <p className="text-gray-400 text-xs mt-0.5">{p.user_id} · {p.phone ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleReject(p.id)}
                        className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition">거절</button>
                      <button onClick={() => handleApprove(p.id)}
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
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">🔑 Gemini API 키 상태</h3>
                {(() => {
                  const k1 = apiKeyStatus.find((x) => x.key_index === 0)
                  const k2 = apiKeyStatus.find((x) => x.key_index === 1)
                  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
                  const k1Exhausted = k1?.last_quota_error_at && new Date(k1.last_quota_error_at).getTime() > dayAgo
                  const active = !k1Exhausted ? 1 : (k2?.last_quota_error_at && new Date(k2.last_quota_error_at).getTime() > dayAgo ? 0 : 2)
                  return (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${active === 0 ? 'bg-red-100 text-red-700' : active === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {active === 0 ? '⚠ 두 키 모두 한도 초과' : active === 1 ? '● Key1 활성' : '● Key2 활성 (Key1 한도 초과)'}
                    </span>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[0, 1].map((idx) => {
                  const s = apiKeyStatus.find((x) => x.key_index === idx)
                  const fmt = (t: string | null) => t ? new Date(t).toLocaleString('ko-KR') : '기록 없음'
                  return (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <p className="font-semibold text-gray-700">Key{idx + 1}</p>
                      <p className="text-gray-500">마지막 사용: <span className="text-gray-700">{fmt(s?.last_used_at ?? null)}</span></p>
                      <p className="text-gray-500">마지막 한도 초과: <span className={s?.last_quota_error_at ? 'text-red-600' : 'text-gray-700'}>{fmt(s?.last_quota_error_at ?? null)}</span></p>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-3">Key1 우선 사용 → 한도 초과 시 Key2로 자동 전환. Google 무료 한도는 매일 자정(태평양 시간) 초기화됩니다.</p>
            </div>
            {teachers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <p className="text-gray-400 text-sm">등록된 강사가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teachers.map((u) => (
                  <div key={u.id} className={`flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-5 ${!u.is_active ? 'opacity-60' : ''}`}>
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
                          {!u.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">비활성</span>}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">{u.user_id} · {u.phone || '전화번호 없음'} · 가입일 {u.created_at?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResetAnalysisCount(u.id, u.name)}
                        className="px-3 py-2 text-xs border border-indigo-200 text-indigo-500 rounded-xl hover:bg-indigo-50 transition">
                        분석횟수 초기화
                      </button>
                      <button onClick={() => handleResetPassword(u.id, u.name)}
                        className="px-3 py-2 text-xs border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition">
                        비밀번호 초기화
                      </button>
                      <button onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`px-3 py-2 text-xs font-medium rounded-xl transition ${u.is_active ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {u.is_active ? '비활성화' : '재활성화'}
                      </button>
                      <button onClick={() => handleDeleteUser(u.id, u.name)}
                        className="px-3 py-2 text-xs border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition">
                        삭제
                      </button>
                    </div>
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
