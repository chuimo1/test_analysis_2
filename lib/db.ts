import { supabase } from './supabase'

// ── Users ──

export async function login(userId: string, password: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { error: `로그인 실패: ${error.message}` }
  if (!data) return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  if (!data.is_approved) return { error: '관리자 승인 대기 중입니다.' }
  if (!data.is_active) return { error: '비활성화된 계정입니다.' }

  if (data.password_hash && data.password_hash !== password) {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }
  if (!data.password_hash && password !== '3700') {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  return { user: data }
}

export async function createSignup(form: {
  userId: string
  name: string
  phone: string
  password: string
  subject: string
}) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('user_id', form.userId)
    .maybeSingle()

  if (existing) return { error: '이미 사용 중인 아이디입니다.' }

  const { error } = await supabase.from('users').insert({
    user_id: form.userId,
    name: form.name,
    phone: form.phone,
    password_hash: form.password,
    role: 'teacher',
    subject: form.subject,
    is_approved: false,
  })

  if (error) return { error: `가입 실패: ${error.message}` }
  return { success: true }
}

export async function getPendingSignups() {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .eq('is_approved', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function approveUser(id: string) {
  await supabase.from('users').update({ is_approved: true }).eq('id', id)
}

export async function rejectUser(id: string) {
  await supabase.from('users').delete().eq('id', id)
}

export async function getTeachers() {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function toggleUserActive(id: string, isActive: boolean) {
  await supabase.from('users').update({ is_active: isActive }).eq('id', id)
}

export async function deleteUser(id: string) {
  await supabase.from('exams').delete().eq('teacher_id', id)
  await supabase.from('subject_change_requests').delete().eq('user_id', id)
  await supabase.from('users').delete().eq('id', id)
}

export async function resetUserPassword(id: string) {
  await supabase.from('users').update({ password_hash: '00000000' }).eq('id', id)
}

export async function updateUserProfile(id: string, data: { phone?: string; password?: string }) {
  const update: Record<string, string> = {}
  if (data.phone) update.phone = data.phone
  if (data.password) update.password_hash = data.password
  await supabase.from('users').update(update).eq('id', id)
}

// ── Exams ──

export async function createExam(exam: {
  teacher_id: string
  subject: string
  grade: string
  school: string
  exam_year: number
  exam_term: string
  exam_scope: unknown[]
  expected_difficulty: string
  teacher_note: string
  analysis: unknown
}) {
  const { data, error } = await supabase
    .from('exams')
    .insert(exam)
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function getExams(teacherId?: string) {
  let query = supabase
    .from('exams')
    .select('*, users!exams_teacher_id_fkey(name, subject)')
    .order('created_at', { ascending: false })

  if (teacherId) {
    query = query.eq('teacher_id', teacherId)
  }

  const { data } = await query
  return data ?? []
}

export async function getExamById(id: string) {
  const { data } = await supabase
    .from('exams')
    .select('*, users!exams_teacher_id_fkey(name, subject)')
    .eq('id', id)
    .single()
  return data
}

export async function updateExamAnalysis(id: string, analysis: unknown) {
  await supabase.from('exams').update({ analysis }).eq('id', id)
}

export async function updateExamBlog(id: string, blogContent: string) {
  await supabase.from('exams').update({ blog_content: blogContent }).eq('id', id)
}

export async function publishExam(id: string, blogContent: string) {
  await supabase.from('exams').update({
    blog_content: blogContent,
    blog_published_at: new Date().toISOString(),
    is_finalized: true,
  }).eq('id', id)
}

export async function finalizeExam(id: string) {
  await supabase.from('exams').update({ is_finalized: true }).eq('id', id)
}

// ── Solution Files (손풀이) ──

export async function uploadSolutionFile(examId: string, questionNumber: number, file: File) {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `solutions/${examId}/q${questionNumber}_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('exam-files')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage
    .from('exam-files')
    .getPublicUrl(path)

  return { url: urlData.publicUrl, fileName: file.name, path }
}

export async function deleteSolutionFile(path: string) {
  await supabase.storage.from('exam-files').remove([path])
}

// ── Subject Change Requests ──

export async function getSubjectChangeRequests() {
  const { data } = await supabase
    .from('subject_change_requests')
    .select('*, users!subject_change_requests_user_id_fkey(name, subject, user_id)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
  return data ?? []
}

export async function processSubjectChange(id: string, approved: boolean) {
  if (approved) {
    const { data: req } = await supabase
      .from('subject_change_requests')
      .select('user_id, requested_subject')
      .eq('id', id)
      .single()

    if (req) {
      await supabase.from('users').update({ subject: req.requested_subject }).eq('id', req.user_id)
    }
  }

  await supabase.from('subject_change_requests').update({
    status: approved ? 'approved' : 'rejected',
    processed_at: new Date().toISOString(),
  }).eq('id', id)
}
