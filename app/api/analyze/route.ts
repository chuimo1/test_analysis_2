import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
  model: ReturnType<typeof genAI.getGenerativeModel>,
  parts: (ImagePart | { text: string })[],
  stagePrompt: string,
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY))
      const result = await model.generateContent([...parts, { text: stagePrompt }])
      return extractJson(result.response.text())
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const subject = formData.get('subject') as string
    const grade = formData.get('grade') as string
    const school = formData.get('school') as string
    const examYear = formData.get('examYear') as string
    const examTerm = formData.get('examTerm') as string
    const expectedDifficulty = formData.get('expectedDifficulty') as string | null
    const teacherNote = formData.get('teacherNote') as string | null
    const examScopeRaw = formData.get('examScope') as string | null
    const currentImage = formData.get('currentImage') as File
    const prevImages = formData.getAll('prevImages') as File[]

    if (!currentImage) {
      return NextResponse.json({ error: '시험지 이미지가 없습니다.' }, { status: 400 })
    }

    const imageBuffer = await currentImage.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    const imageMimeType = currentImage.type || 'image/jpeg'

    const prevImageParts: ImagePart[] = await Promise.all(
      prevImages.map(async (file) => {
        const buf = await file.arrayBuffer()
        return {
          inlineData: {
            data: Buffer.from(buf).toString('base64'),
            mimeType: file.type || 'image/jpeg',
          },
        }
      })
    )

    const model = genAI.getGenerativeModel({ model: 'models/gemini-3-flash-preview' })

    const subjectGuide = SUBJECT_PROMPT[subject] ?? ''
    const hasPrev = prevImageParts.length > 0
    let scopeInfo = ''
    if (examScopeRaw) {
      try {
        const parsed = JSON.parse(examScopeRaw) as { category: string; detail: string }[]
        if (parsed.length > 0) {
          scopeInfo = `- 시험 출제 범위:\n${parsed.map((s) => `  · [${s.category}] ${s.detail}`).join('\n')}\n  이 범위를 참고하여 각 문항의 출처(source)를 분류하세요.`
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
${hasPrev ? `- 전년도 시험지 ${prevImageParts.length}개도 함께 제공됩니다.` : ''}
${preAnalysisBlock}

첫 번째 이미지는 분석할 시험지입니다.${hasPrev ? ' 이후 이미지들은 전년도 시험지입니다.' : ''}`

    const imageParts: (ImagePart | { text: string })[] = [
      { inlineData: { data: imageBase64, mimeType: imageMimeType } },
      ...prevImageParts,
      { text: baseContext },
    ]

    // 4단계 분리: 문제 → 총평 → 킬러 → 전략
    // 부분 성공도 저장, 실패 부분만 재시도

    const stagePrompts = [
      {
        key: 'questions',
        prompt: `${baseContext}

시험지의 각 문제를 분석하여 JSON으로 응답하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.

{"questions": [{"number": 1, "type": "객관식 | 단답형 | 서술형", "mainUnit": "대단원명", "subUnit": "중단원명", "intent": "출제자 의도", "expectedCorrectRate": 75, "difficulty": "상 | 중상 | 중 | 중하 | 하", "score": "배점 숫자 또는 \"-\""}]}

반드시 모든 문제를 빠짐없이 분석하세요.`,
      },
      {
        key: 'overview',
        prompt: `${baseContext}

시험 총평을 JSON으로 응답하세요.

{"keyFeatures": ["특징1", "특징2", "특징3", "특징4"], "examSummary": "시험 전체에 대한 종합 총평을 3~5문장으로 작성. 난이도 수준, 출제 경향, 변별력 포인트 등을 포함.", "aiDifficulty": "상 | 중상 | 중 | 중하 | 하", "aiDifficultyReason": "AI가 판단한 난이도의 근거를 2~3문장으로 설명", "commonMistakes": [{"area": "실수가 많이 발생하는 영역/단원", "description": "학생들이 구체적으로 어떤 실수를 하는지, 왜 틀리는지 설명", "tip": "실수 방지를 위한 구체적 팁"}], "yearOverYearComparison": "${hasPrev ? '전년도와 비교 2~3문장' : '전년도 시험지 없음. 이번 시험 특성만 서술.'}"}

aiDifficulty는 강사가 입력한 시험 정보(출제 범위, 예상 난이도, 메모)와 실제 시험지 내용을 종합하여 객관적으로 판단하세요.
examSummary는 학부모·학생이 읽을 수 있도록 명확하게 작성하세요.
commonMistakes는 3~5개 항목으로, 실제 학생들이 자주 하는 실수를 구체적으로 작성하세요.`,
      },
      {
        key: 'killer',
        prompt: `${baseContext}

킬러문항(난이도 상 + 예상정답률 낮은 순)을 최대 5개 선정하여 JSON으로 응답하세요.

{"killerQuestions": [{"number": 8, "subUnit": "중단원명", "intent": "출제자 의도", "difficulty": "상", "rate": 42, "reason": "킬러문항인 이유"}]}`,
      },
      {
        key: 'strategy',
        prompt: `${baseContext}

출제 경향과 대응 전략을 4~5개 작성하여 JSON으로 응답하세요.

{"strategies": [{"trend": "출제 경향", "strategy": "대응 학습 전략"}]}`,
      },
    ]

    const results: Record<string, unknown> = {}
    const errors: { stage: string; error: string }[] = []

    for (const stage of stagePrompts) {
      try {
        if (Object.keys(results).length > 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
        const data = await runStage(model, imageParts, stage.prompt)
        Object.assign(results, data)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push({ stage: stage.key, error: msg })
      }
    }

    if (!results.questions && errors.length > 0) {
      return NextResponse.json(
        { error: `분석 실패: ${errors.map((e) => `${e.stage}(${e.error})`).join(', ')}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      subject,
      grade,
      school,
      examYear: Number(examYear),
      examTerm,
      expectedDifficulty: expectedDifficulty ?? '중',
      teacherNote: teacherNote ?? '',
      examScope: examScopeRaw ? JSON.parse(examScopeRaw) : [],
      ...results,
      _errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Gemini API error:', message)
    return NextResponse.json({ error: `분석 오류: ${message}` }, { status: 500 })
  }
}
