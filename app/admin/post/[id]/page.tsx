'use client'

import { useParams } from 'next/navigation'
import ExamAnalysis from '@/app/components/ExamAnalysis'

export default function AdminPostPage() {
  const params = useParams()
  const id = params.id as string
  return <ExamAnalysis examId={id} mode="admin" />
}
