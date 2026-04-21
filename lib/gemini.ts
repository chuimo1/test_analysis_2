import { GoogleGenerativeAI } from '@google/generative-ai'
import { recordApiKeyUsage, getApiKeyStatus } from './db'

export const MODEL = 'gemini-3.1-flash-lite-preview'

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[]
export const genAIs = API_KEYS.map((key) => new GoogleGenerativeAI(key))

export type ImagePart = { inlineData: { data: string; mimeType: string } }

const MAX_RETRIES = 2
const RETRY_DELAY = 2000

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|quota|rate.?limit|too many/i.test(msg)
}

export function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON 파싱 실패')
  return JSON.parse(match[0])
}

export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`)
  const buf = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  return { data: Buffer.from(buf).toString('base64'), mimeType }
}

export function distributeImages<T>(items: T[], buckets: number): T[][] {
  const out: T[][] = Array.from({ length: buckets }, () => [])
  items.forEach((it, i) => out[i % buckets].push(it))
  return out
}

export async function runStage(
  parts: (ImagePart | { text: string })[],
  stagePrompt: string,
  keyOrder: number[],
): Promise<{ data: Record<string, unknown>; keyIndex: number }> {
  let lastError: Error | null = null
  for (const keyIdx of keyOrder) {
    const model = genAIs[keyIdx].getGenerativeModel({ model: MODEL })
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY))
        const result = await model.generateContent([...parts, { text: stagePrompt }])
        return { data: extractJson(result.response.text()), keyIndex: keyIdx }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (isQuotaError(err)) {
          recordApiKeyUsage(keyIdx, 'quota_error').catch(() => {})
          break
        }
      }
    }
  }
  throw lastError
}

export async function getKeyOrder(preferredKey: number): Promise<number[]> {
  const status = await getApiKeyStatus().catch(() => [])
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const isAlive = (i: number) => {
    const s = status.find((x) => x.key_index === i)
    return !s?.last_quota_error_at || new Date(s.last_quota_error_at).getTime() <= dayAgo
  }
  const allIdx = genAIs.map((_, i) => i)
  if (allIdx.length === 0) return []
  const safePreferred = preferredKey >= allIdx.length ? allIdx[allIdx.length - 1] : preferredKey
  const others = allIdx.filter((i) => i !== safePreferred)
  return [safePreferred, ...others.filter(isAlive), ...others.filter((i) => !isAlive(i))]
}

export const SUBJECT_PROMPT: Record<string, string> = {
  국어: '국어 시험지입니다. mainUnit(유형)은 문학/독서/문법 중 하나로 분류하세요. subUnit(중단원)은 현대시, 현대소설, 고전시가, 고전소설, 비문학, 음운론, 형태론 등으로 분류하세요. 출제자 의도는 주제찾기, 내용파악, 의미파악, 시제파악, 함의찾기, 감상하기, 개념파악 등으로 분류하세요.',
  영어: '영어 시험지입니다. mainUnit(유형)은 문법/독해/어휘/듣기 중 하나로 분류하세요. subUnit(중단원)은 시제, 관계사, 장문독해, 단문독해, 어휘추론 등으로 분류하세요. 출제자 의도는 빈칸채우기, 함의찾기, 주제파악, 내용파악, 문법이해, 어휘력 등으로 분류하세요.',
  수학: '수학 시험지입니다. mainUnit(대단원)은 수와 연산, 문자와 식, 함수, 기하, 확률과 통계 등 교육과정 대단원으로 분류하세요. subUnit(중단원)은 해당 대단원의 세부 단원으로 분류하세요. 출제자 의도는 개념이해, 계산하기, 공식적용, 증명하기, 문제해결 등으로 분류하세요.',
  사회: '사회 시험지입니다. mainUnit(대단원)은 지리, 역사, 일반사회, 경제 등으로 분류하세요. subUnit(중단원)은 해당 대단원의 세부 단원으로 분류하세요. 출제자 의도는 개념파악, 연도파악, 사건이해, 원인분석, 비교분석 등으로 분류하세요.',
}

export type ExamMeta = {
  subject: string
  grade: string
  school: string
  examYear: string
  examTerm: string
  expectedDifficulty?: string
  teacherNote?: string
  examScope?: string
}

export function buildBaseContext(meta: ExamMeta, totalImages: number): string {
  const subjectGuide = SUBJECT_PROMPT[meta.subject] ?? ''
  let scopeInfo = ''
  if (meta.examScope) {
    try {
      const parsed = JSON.parse(meta.examScope) as { category: string; detail: string }[]
      if (parsed.length > 0) {
        const textbookScopes = parsed.filter((s) => s.category === '교과서')
        const unitHint = meta.subject === '수학' && textbookScopes.length > 0
          ? `\n  ※ 수학 과목입니다. 위 [교과서] 범위에 입력된 단원명(예: "다항식, 방정식, 부등식")을 mainUnit(대단원) 분류의 핵심 근거로 사용하세요. 교과서 범위에 없는 대단원으로 분류하지 마세요. (부교재/학습지/모의고사 범위는 mainUnit 분류에 사용하지 않습니다.)`
          : ''
        scopeInfo = `- 시험 출제 범위:\n${parsed.map((s) => `  · [${s.category}] ${s.detail}`).join('\n')}\n  이 범위를 참고하여 각 문항의 출처(source)를 분류하세요.${unitHint}`
      }
    } catch {
      scopeInfo = `- 시험 범위: ${meta.examScope}`
    }
  }
  const difficultyInfo = meta.expectedDifficulty ? `- 강사 예상 난이도: ${meta.expectedDifficulty}` : ''
  const noteInfo = meta.teacherNote ? `- 강사 메모: ${meta.teacherNote}` : ''

  const preAnalysisBlock = (scopeInfo || difficultyInfo || noteInfo)
    ? `
[중요] 강사가 사전에 입력한 정보입니다. 반드시 참고하여 분석하세요:
${scopeInfo}
${difficultyInfo}
${noteInfo}
위 사전 정보를 참고하여 각 문항의 출처, 단원 분류, 난이도 판단에 적극 활용하세요.`
    : ''

  return `당신은 학원 강사를 위한 시험 분석 전문가입니다.

${subjectGuide}

시험 정보:
- 과목: ${meta.subject}
- 학년: ${meta.grade}
- 학교: ${meta.school}
- 연도: ${meta.examYear}년
- 시험: ${meta.examTerm}
- 분석할 시험지는 총 ${totalImages}장의 이미지로 구성되어 있습니다.
${preAnalysisBlock}`
}
