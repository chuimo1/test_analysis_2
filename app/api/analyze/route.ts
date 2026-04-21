import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { recordApiKeyUsage, getApiKeyStatus } from '@/lib/db'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MODEL = 'gemini-3.1-flash-lite-preview'

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[]
const genAIs = API_KEYS.map((key) => new GoogleGenerativeAI(key))

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /429|quota|rate.?limit|too many/i.test(msg)
}

const SUBJECT_PROMPT: Record<string, string> = {
  국어: '국어 시험지입니다. mainUnit(유형)은 문학/독서/문법 중 하나로 분류하세요. subUnit(중단원)은 현대시, 현대소설, 고전시가, 고전소설, 비문학, 음운론, 형태론 등으로 분류하세요. 출제자 의도는 주제찾기, 내용파악, 의미파악, 시제파악, 함의찾기, 감상하기, 개념파악 등으로 분류하세요.',
  영어: '영어 시험지입니다. mainUnit(유형)은 문법/독해/어휘/듣기 중 하나로 분류하세요. subUnit(중단원)은 시제, 관계사, 장문독해, 단문독해, 어휘추론 등으로 분류하세요. 출제자 의도는 빈칸채우기, 함의찾기, 주제파악, 내용파악, 문법이해, 어휘력 등으로 분류하세요.',
  수학: '수학 시험지입니다. mainUnit(대단원)은 수와 연산, 문자와 식, 함수, 기하, 확률과 통계 등 교육과정 대단원으로 분류하세요. subUnit(중단원)은 해당 대단원의 세부 단원으로 분류하세요. 출제자 의도는 개념이해, 계산하기, 공식적용, 증명하기, 문제해결 등으로 분류하세요.',
  사회: '사회 시험지입니다. mainUnit(대단원)은 지리, 역사, 일반사회, 경제 등으로 분류하세요. subUnit(중단원)은 해당 대단원의 세부 단원으로 분류하세요. 출제자 의도는 개념파악, 연도파악, 사건이해, 원인분석, 비교분석 등으로 분류하세요.',
}

const MAX_RETRIES = 2
const RETRY_DELAY = 2000

type ImagePart = { inlineData: { data: string; mimeType: string } }

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON 파싱 실패')
  return JSON.parse(match[0])
}

async function runStage(
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

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`)
  const buf = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  return { data: Buffer.from(buf).toString('base64'), mimeType }
}

function distributeImages<T>(items: T[], buckets: number): T[][] {
  const out: T[][] = Array.from({ length: buckets }, () => [])
  items.forEach((it, i) => out[i % buckets].push(it))
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      subject, grade, school, examYear, examTerm,
      expectedDifficulty, teacherNote, examScope: examScopeRaw,
      currentImageUrl, currentImageUrls,
    } = body as {
      subject: string; grade: string; school: string
      examYear: string; examTerm: string
      expectedDifficulty?: string; teacherNote?: string; examScope?: string
      currentImageUrl?: string; currentImageUrls?: string[]; prevImageUrls?: string[]
    }

    const currentUrls = currentImageUrls ?? (currentImageUrl ? [currentImageUrl] : [])
    if (currentUrls.length === 0) {
      return NextResponse.json({ error: '시험지 이미지가 없습니다.' }, { status: 400 })
    }

    const currentImageParts: ImagePart[] = []
    for (const url of currentUrls) {
      const img = await urlToBase64(url)
      currentImageParts.push({ inlineData: img })
    }

    const subjectGuide = SUBJECT_PROMPT[subject] ?? ''
    let scopeInfo = ''
    if (examScopeRaw) {
      try {
        const parsed = JSON.parse(examScopeRaw) as { category: string; detail: string }[]
        if (parsed.length > 0) {
          const textbookScopes = parsed.filter((s) => s.category === '교과서')
          const unitHint = subject === '수학' && textbookScopes.length > 0
            ? `\n  ※ 수학 과목입니다. 위 [교과서] 범위에 입력된 단원명(예: "다항식, 방정식, 부등식")을 mainUnit(대단원) 분류의 핵심 근거로 사용하세요. 교과서 범위에 없는 대단원으로 분류하지 마세요. (부교재/학습지/모의고사 범위는 mainUnit 분류에 사용하지 않습니다.)`
            : ''
          scopeInfo = `- 시험 출제 범위:\n${parsed.map((s) => `  · [${s.category}] ${s.detail}`).join('\n')}\n  이 범위를 참고하여 각 문항의 출처(source)를 분류하세요.${unitHint}`
        }
      } catch {
        scopeInfo = `- 시험 범위: ${examScopeRaw}`
      }
    }
    const difficultyInfo = expectedDifficulty ? `- 강사 예상 난이도: ${expectedDifficulty}` : ''
    const noteInfo = teacherNote ? `- 강사 메모: ${teacherNote}` : ''

    const preAnalysisBlock = (scopeInfo || difficultyInfo || noteInfo)
      ? `
[중요] 강사가 사전에 입력한 정보입니다. 반드시 참고하여 분석하세요:
${scopeInfo}
${difficultyInfo}
${noteInfo}
위 사전 정보를 참고하여 각 문항의 출처, 단원 분류, 난이도 판단에 적극 활용하세요.`
      : ''

    const baseContext = `당신은 학원 강사를 위한 시험 분석 전문가입니다.

${subjectGuide}

시험 정보:
- 과목: ${subject}
- 학년: ${grade}
- 학교: ${school}
- 연도: ${examYear}년
- 시험: ${examTerm}
- 분석할 시험지는 총 ${currentImageParts.length}장의 이미지로 구성되어 있습니다.
${preAnalysisBlock}`

    // ── Phase 1: distribute images across keys 0,1,2 → extract questions in parallel ──
    const PHASE1_KEY_COUNT = Math.min(3, genAIs.length)
    const totalImages = currentImageParts.length
    const chunkCount = Math.min(totalImages, PHASE1_KEY_COUNT)
    const chunks = distributeImages(currentImageParts, chunkCount).filter((c) => c.length > 0)

    const status = await getApiKeyStatus().catch(() => [])
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    const isAlive = (i: number) => {
      const s = status.find((x) => x.key_index === i)
      return !s?.last_quota_error_at || new Date(s.last_quota_error_at).getTime() <= dayAgo
    }
    const allIdx = genAIs.map((_, i) => i)
    if (allIdx.length === 0) {
      return NextResponse.json({ error: 'API 키가 등록되어 있지 않습니다.' }, { status: 503 })
    }

    const phase1Prompt = (chunkSize: number) => `${baseContext}

[Phase 1: 문제 추출 작업]
당신에게 전체 ${totalImages}장 중 일부인 ${chunkSize}장의 이미지가 주어집니다.
이 이미지들에 보이는 문제만 빠짐없이 추출하여 JSON으로 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

{"questions": [{"number": 1, "type": "객관식 | 단답형 | 서술형", "mainUnit": "대단원명", "subUnit": "중단원명", "intent": "출제자 의도", "expectedCorrectRate": 75, "difficulty": "상 | 중상 | 중 | 중하 | 하", "score": "배점 숫자 또는 \\"-\\""}]}

규칙:
- 문제 번호(number)는 시험지에 인쇄된 번호 그대로 사용하세요. 1부터 다시 매기지 마세요.
- 이 이미지들에 보이지 않는 문제는 절대 추가하지 마세요.
- 잘려서 부분만 보이는 문제도 번호가 보이면 추출하세요.`

    const phase1Settled = await Promise.all(
      chunks.map((chunk, idx) => {
        const preferredKey = idx % allIdx.length
        const otherKeys = allIdx.filter((i) => i !== preferredKey)
        const aliveOthers = otherKeys.filter(isAlive)
        const deadOthers = otherKeys.filter((i) => !isAlive(i))
        const keyOrder = [preferredKey, ...aliveOthers, ...deadOthers]
        return runStage(chunk, phase1Prompt(chunk.length), keyOrder)
      }),
    )

    const allQuestions: Record<string, unknown>[] = []
    for (const r of phase1Settled) {
      const qs = r.data.questions
      if (Array.isArray(qs)) allQuestions.push(...qs)
      recordApiKeyUsage(r.keyIndex, 'success').catch(() => {})
    }
    allQuestions.sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0))

    if (allQuestions.length === 0) {
      return NextResponse.json({ error: '문제를 한 개도 추출하지 못했습니다.' }, { status: 500 })
    }

    // ── Phase 2: synthesis on key 3 (or last) using merged questions text ──
    const phase2Prompt = `${baseContext}

[Phase 2: 시험 종합 분석 작업]
다음은 Phase 1에서 추출한 시험의 모든 문제 정보입니다 (JSON 배열).
이 정보를 바탕으로 시험 총평 / 킬러문항 / 출제경향·전략을 한 번에 JSON으로 응답하세요. JSON 외 다른 텍스트는 포함하지 마세요.

[추출된 문제 데이터]
${JSON.stringify(allQuestions, null, 2)}

응답 JSON 형식:
{
  "keyFeatures": ["특징1", "특징2", "특징3", "특징4"],
  "examSummary": "시험 전체 종합 총평 3~5문장. 난이도 수준, 출제 경향, 변별력 포인트 포함.",
  "aiDifficulty": "상 | 중상 | 중 | 중하 | 하",
  "aiDifficultyReason": "AI 판단 난이도의 근거 2~3문장",
  "commonMistakes": [{"area": "실수가 잦은 영역/단원", "description": "학생들이 어떤 실수를 왜 하는지", "tip": "실수 방지 팁"}],
  "yearOverYearComparison": "전년도 시험지 없음. 이번 시험 특성만 서술.",
  "killerQuestions": [{"number": 8, "subUnit": "중단원명", "intent": "출제자 의도", "difficulty": "상", "rate": 42, "reason": "킬러문항인 이유"}],
  "strategies": [{"trend": "출제 경향", "strategy": "대응 학습 전략"}]
}

규칙:
- aiDifficulty는 강사 사전 정보(범위/예상난이도/메모)와 추출된 문제 데이터를 종합 판단.
- examSummary는 학부모·학생이 읽을 수 있도록 명확하게 작성.
- commonMistakes는 3~5개 항목.
- killerQuestions는 난이도 상 + 정답률 낮은 순으로 최대 5개. number는 추출된 문제 번호 중에서만 선택.
- strategies는 4~5개.`

    const phase2PreferredKey = Math.min(3, allIdx.length - 1)
    const phase2Others = allIdx.filter((i) => i !== phase2PreferredKey)
    const phase2KeyOrder = [phase2PreferredKey, ...phase2Others.filter(isAlive), ...phase2Others.filter((i) => !isAlive(i))]
    const phase2 = await runStage([], phase2Prompt, phase2KeyOrder)
    recordApiKeyUsage(phase2.keyIndex, 'success').catch(() => {})

    return NextResponse.json({
      subject,
      grade,
      school,
      examYear: Number(examYear),
      examTerm,
      expectedDifficulty: expectedDifficulty ?? '중',
      teacherNote: teacherNote ?? '',
      examScope: examScopeRaw ? JSON.parse(examScopeRaw) : [],
      questions: allQuestions,
      ...phase2.data,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Gemini API error:', message)
    return NextResponse.json({ error: `분석 오류: ${message}` }, { status: 500 })
  }
}
