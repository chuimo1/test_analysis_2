'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { generateBlogHtml } from '@/lib/blog-html'
import { getExamById, updateExamBlog, publishExam } from '@/lib/db'

export default function AdminPostPage() {
  const params = useParams()
  const id = params.id as string

  const [blogHtml, setBlogHtml] = useState('')
  const [meta, setMeta] = useState({ teacher: '', date: '', title: '', status: '' })
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [solutionFiles, setSolutionFiles] = useState<{ questionNumber: number; files: { url: string; fileName: string }[] }[]>([])

  useEffect(() => {
    getExamById(id).then((exam) => {
      if (!exam) return
      const a = exam.analysis as Record<string, unknown> | null

      setMeta({
        teacher: exam.users?.name ?? '강사',
        date: exam.created_at?.slice(0, 10) ?? '',
        title: `${exam.exam_year}년 ${exam.school} ${exam.grade} ${exam.exam_term} ${exam.subject}`,
        status: exam.blog_published_at ? '발행 완료' : exam.is_finalized ? '수정 완료' : '수정 중',
      })

      if (a) {
        const killers = (a.killerQuestions as { number: number; solutionFiles?: { url: string; fileName: string }[] }[]) ?? []
        const sols = killers
          .filter((k) => k.solutionFiles && k.solutionFiles.length > 0)
          .map((k) => ({ questionNumber: k.number, files: k.solutionFiles! }))
        setSolutionFiles(sols)
      }

      if (exam.blog_content) {
        setBlogHtml(exam.blog_content)
      } else if (a) {
        const html = generateBlogHtml({
          subject: exam.subject,
          grade: exam.grade,
          school: exam.school,
          examYear: exam.exam_year,
          examTerm: exam.exam_term,
          keyFeatures: (a.keyFeatures as string[]) ?? [],
          yearOverYearComparison: (a.yearOverYearComparison as string) ?? '',
          killerQuestions: (a.killerQuestions as []) ?? [],
          strategies: (a.strategies as []) ?? [],
          questions: (a.questions as []) ?? [],
        })
        setBlogHtml(html)
      }
    })
  }, [id])

  function saveBlogContent(html: string) {
    updateExamBlog(id, html)
  }

  async function handleCopy() {
    const el = document.createElement('div')
    el.innerHTML = blogHtml
    await navigator.clipboard.writeText(el.innerText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleCopyHtml() {
    await navigator.clipboard.writeText(blogHtml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handlePublish() {
    await publishExam(id, blogHtml)
    setMeta((prev) => ({ ...prev, status: '발행 완료' }))
  }

  const statusColor =
    meta.status === '발행 완료'
      ? 'bg-green-100 text-green-700'
      : meta.status === '수정 완료'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-yellow-100 text-yellow-700'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">품격에듀</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">관리자</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              목록
            </Link>
            <button onClick={() => { setEditing(!editing); if (editing) saveBlogContent(blogHtml) }}
              className={`text-sm px-4 py-2 rounded-xl transition ${editing ? 'bg-green-600 hover:bg-green-700 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {editing ? '편집 저장' : '편집'}
            </button>
            <button onClick={handleCopy}
              className="text-sm border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
              텍스트 복사
            </button>
            <button onClick={handleCopyHtml}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl transition">
              HTML 복사
            </button>
          </div>
        </div>
      </header>

      {copied && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          클립보드에 복사됐습니다!
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">{meta.teacher} 강사 · {meta.date}</p>
            <h1 className="text-xl font-bold text-gray-900">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}>{meta.status}</span>
            {meta.status !== '발행 완료' && (
              <button onClick={handlePublish}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full font-medium transition">
                발행 처리
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {editing ? (
            <textarea
              value={blogHtml}
              onChange={(e) => setBlogHtml(e.target.value)}
              className="w-full h-[600px] font-mono text-sm text-gray-800 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          ) : (
            <div
              className="prose prose-gray max-w-none text-sm leading-relaxed
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mb-4
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h2]:mb-3
                [&_p]:text-gray-700 [&_p]:mb-3
                [&_ul]:space-y-1 [&_ul]:mb-4 [&_li]:text-gray-700
                [&_ol]:space-y-2 [&_ol]:mb-4
                [&_strong]:font-semibold [&_strong]:text-gray-900"
              dangerouslySetInnerHTML={{ __html: blogHtml }}
            />
          )}
        </div>

        {solutionFiles.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">📎 손풀이 자료</h2>
            <div className="space-y-3">
              {solutionFiles.map((sq, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-gray-700 mb-1">{sq.questionNumber}번 문항</p>
                  <div className="flex flex-wrap gap-2">
                    {sq.files.map((f, fi) => (
                      <a key={fi} href={f.url} target="_blank" rel="noopener noreferrer" download
                        className="inline-flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition border border-indigo-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {f.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button onClick={handleCopy}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition">
            텍스트로 복사하기
          </button>
          <button onClick={handleCopyHtml}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-3 rounded-xl transition">
            HTML로 복사 (블로그 붙여넣기용)
          </button>
        </div>
      </main>
    </div>
  )
}
