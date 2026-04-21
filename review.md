# 📋 exam-analyzer_2 코드 상세 리뷰 보고서

> 작성일: 2026-04-21
> 분석 대상: `D:/00000. 코딩/exam-analyzer_2` (품격에듀 AI 시험분석기)
> 작성 원칙: **비전공자도 읽을 수 있도록** 쉬운 말로. 문제가 될 만한 점은 빼먹지 않고 깊게.

---

## 0. 한 줄 요약

> "UI와 AI 분석 플로우는 잘 짜여 있지만, **DB 스키마와 코드가 어긋나 있고(⚠ 심각), 인증이 사실상 없으며, 사용 중인 Gemini 모델명이 실존하지 않는 이름**이라 지금 상태로는 실제 서비스가 불가능에 가깝습니다."

아래에서 그 이유를 하나씩 풀어서 설명합니다.

---

## 1. 서비스가 어떻게 동작하는가 (전체 흐름)

### 1-1. 누가 쓰는 서비스인가
- **강사**: 시험지 사진을 찍어 올리면 AI가 자동으로 분석해 줌
- **실장(관리자)**: 강사가 제출한 분석을 확인하고 블로그용 텍스트로 복사
- **원생/학부모**: (아직 없음, 추후 예정)

### 1-2. 큰 그림 흐름
```
① 강사 로그인  →  ② 시험지 이미지 업로드
   ↓
③ 이미지가 Supabase Storage(인터넷 저장소)에 올라감
   ↓
④ 우리 서버(/api/analyze)가 Google Gemini AI에게 이미지 전달
   ↓
⑤ Gemini가 문제별 분석(난이도/단원/정답률 등)을 JSON으로 돌려줌
   ↓
⑥ 결과를 Supabase DB(exams 테이블)에 저장
   ↓
⑦ 강사가 결과 수정/제출  →  실장이 검토/발행
```

### 1-3. 기술 구성
| 부위 | 사용 기술 |
|---|---|
| 화면(프론트) | Next.js 16 + React 19 + Tailwind CSS 4 |
| 백엔드 API | Next.js App Router의 `/api/analyze` |
| AI | Google Gemini (`@google/generative-ai` 라이브러리) |
| DB + 파일저장 | Supabase (PostgreSQL + Storage) |
| 차트 | Recharts |
| 배포 | Vercel 추정 (`vercel.json` 존재) |

---

## 2. 폴더 구조와 역할

```
exam-analyzer_2/
├── app/                           (화면 + API)
│   ├── page.tsx                   → 무조건 /login으로 이동
│   ├── login/page.tsx             → 로그인 화면
│   ├── signup/page.tsx            → 강사 가입 신청
│   ├── teacher/                   → 강사 전용 영역
│   │   ├── page.tsx               → 강사 목록 화면
│   │   ├── upload/page.tsx        → 시험지 업로드
│   │   └── analysis/[id]/page.tsx → 분석 결과 보기·수정
│   ├── admin/                     → 실장 전용 영역
│   │   ├── page.tsx               → 실장 대시보드(가입 승인, 강사 관리, 분석 목록, API 키 상태)
│   │   └── post/[id]/page.tsx     → 실장의 분석 상세 페이지
│   ├── components/
│   │   └── ExamAnalysis.tsx       → 강사/실장이 공유하는 거대한 분석 뷰(1160줄)
│   └── api/
│       ├── analyze/route.ts       → Gemini 호출 핵심 로직
│       └── models/route.ts        → 사용 가능한 Gemini 모델 목록 조회(디버그용)
├── lib/
│   ├── db.ts                      → Supabase로 DB/Storage 호출 래퍼
│   ├── gemini.ts                  → Gemini 공통 도우미 (⚠ 그런데 import 하는 곳이 없음. 사실상 죽은 코드)
│   ├── blog-html.ts               → 블로그용 HTML 생성 (⚠ generateBlogHtml을 호출하는 곳이 없음)
│   ├── supabase.ts                → Supabase 클라이언트 생성
│   └── types.ts                   → TypeScript 타입 정의
├── supabase/
│   └── schema.sql                 → DB 테이블 생성 스크립트
├── .env.local                     → 실제 API 키(민감!)
├── next.config.ts                 → Next.js 설정
├── vercel.json                    → 배포 설정 (maxDuration 60초)
└── package.json
```

---

## 3. 강점 (잘 짜인 부분)

1. **UI/UX 품질이 높다.** Tailwind 기반 디자인이 세련되고 일관성이 있다. 버튼 상태(저장됨/복사됨), 배지 색상, 모달 처리 등 디테일이 좋음.
2. **Gemini API 키 4개 로테이션 + 상태 추적.** 무료 한도 한 키가 막히면 다른 키로 넘어가고, `api_key_status` 테이블로 마지막 사용/막힌 시각을 기록. 관리자 화면에서 시각화도 제공.
3. **2단계 분석 파이프라인(Phase 1 → Phase 2).** 이미지를 키 개수만큼 쪼개 병렬로 문제 추출(1단계) → 추출된 JSON만 4번째 키로 종합 분석(2단계). 시간 단축에 합리적인 설계.
4. **업로드 전 클라이언트측 이미지 압축.** `compressImage()`로 1600px 이하로 리사이즈 → Gemini 요금/속도/용량 모두 이득.
5. **주간 분석 횟수 쿼터 (주당 3회).** 남용 방지 장치가 있다.
6. **강사 과목 고정.** 강사 계정의 담당 과목에 따라 업로드 시 과목이 자동 고정되어 오입력 방지.
7. **JSON 파싱 방어.** Gemini 응답에서 `\{...\}` 블록을 정규식으로 추출 → 잡다한 머리말이 섞여도 파싱 가능.
8. **DB 트리거로 `updated_at` 자동 갱신.** 스키마 설계에서 이 정도 기본기는 있음.
9. **강사/실장 화면 재사용.** `ExamAnalysis.tsx` 하나로 `mode='teacher' | 'admin'` 분기 → 중복 코드 제거.

---

## 4. 🚨 치명적 오류 (서비스 자체가 안 돌아가는 문제)

### 4-1. **DB 스키마와 코드가 어긋난다 (최우선 수정)**

`supabase/schema.sql`에 **없는 컬럼/테이블**을 코드가 마구 참조하고 있습니다. 신규 DB에 `schema.sql`만 실행하면 **로그인부터 에러**가 납니다.

| 코드가 참조하는 것 | schema.sql에 있나? | 영향 |
|---|---|---|
| `users.password_hash` | ❌ 없음 | 로그인/가입 전부 실패 |
| `users.analysis_count_reset_at` | ❌ 없음 | 분석 횟수 초기화 버튼 → 에러. 업로드 페이지에서 쿼터 조회 → 에러 |
| `api_key_status` 테이블 | ❌ 없음 | 관리자 대시보드의 API 키 상태 박스 → 빈값. 매 분석마다 `upsert` 에러 로그 |
| `exams.blog_content` | ❌ 없음 | `updateExamBlog`, `publishExam` 호출 시 에러 |
| `exam-files` Storage 버킷 | ❌ SQL에 정의 없음 | Supabase 대시보드에서 수동으로 만들지 않으면 업로드 전부 실패 |
| `exam_files` 테이블 | ✅ 있음, 그러나 **코드에서 한 번도 안 씀** | 죽은 테이블 (파일 청소 기능 미구현) |
| `users.first_login_completed` | ✅ 있음, 그러나 **코드에서 한 번도 안 씀** | plan.md의 "첫 로그인 비번 변경 강제"가 구현 안 됨 |

> 💡 이 하나만 해결해도 서비스 부팅은 됩니다. 아래 §10에서 재설계 안을 제시합니다.

### 4-2. **존재하지 않는 Gemini 모델명**

`app/api/analyze/route.ts:8`, `lib/gemini.ts:4`
```
const MODEL = 'models/gemini-3-flash-preview'
```
- **"gemini-3-flash-preview"는 2026-04 현재 Google이 공개한 적이 없는 모델명**입니다. Gemini 2.x(2.0-flash, 2.5-flash, 2.5-pro 등)까지가 공개된 모델. 3.x는 공표 안 됨.
- 이 이름으로 호출하면 **100% `models/... not found` 에러** → 분석이 전부 실패.
- 게다가 라이브러리 규약상 `getGenerativeModel({ model: ... })`에 넘기는 값은 보통 `gemini-2.5-flash`처럼 **접두사 `models/` 없이** 써야 합니다. `models/` 붙이면 또 한 번 실패 가능성.

> 🎯 실제로 쓸 수 있는 이름으로 교체 필요 (예: `gemini-2.5-flash`, `gemini-2.5-pro`). `/api/models` 엔드포인트로 내 API 키가 어떤 모델을 볼 수 있는지 먼저 확인해야 합니다.

### 4-3. **lib/gemini.ts가 중복·사장 코드다**

`route.ts`에 똑같은 상수/함수(`MODEL`, `runStage`, `extractJson`, `SUBJECT_PROMPT`, `buildBaseContext`…)가 **통째로 복붙**되어 있고, 그런데 `lib/gemini.ts`를 import하는 곳은 **0곳**입니다. (`route.ts`가 자체 사본을 씀)
- 유지보수 시 둘을 따로 고쳐야 하는 함정. 한쪽만 고치면 "분명히 바꿨는데 왜 안 바뀌지?" 현상.

### 4-4. **`blog-html.ts`의 `generateBlogHtml`을 부르는 곳이 없다**

블로그 HTML 자동 생성 기능이 10KB짜리 파일로 구현되어 있는데 어느 화면에서도 호출되지 않습니다. "블로그 발행" 버튼의 실제 동작은 `publishExam(examDbId, '')` — **빈 문자열을 blog_content로 저장**만 합니다(심지어 스키마에 컬럼도 없음).

---

## 5. 🔴 보안/인증 치명타

### 5-1. **실질적 인증이 전혀 없다**
- 로그인 검증이 브라우저의 `localStorage.currentUser` **딱 하나**로 끝납니다.
- 사용자가 DevTools로 `localStorage.setItem('currentUser', '{"role":"admin"}')`만 치면 **즉시 관리자**가 됩니다.
- `/teacher`, `/admin`, `/admin/post/*` 어느 페이지도 **서버측 가드가 없음**. URL만 알면 직접 접근 가능.

### 5-2. **비밀번호 평문 저장**
- `db.ts:17`에서 `data.password_hash !== password` — 이름은 `password_hash`지만 **해시가 아니라 평문 비교**입니다.
- 가입 시에도 그대로 DB에 넣습니다 (`password_hash: form.password`).
- Supabase가 털리거나, 관리자 계정 하나만 뚫려도 **모든 강사 비밀번호 유출**.

### 5-3. **특수 매직 비밀번호 `'3700'` 백도어**
`db.ts:20`
```
if (!data.password_hash && password !== '3700') { ... }
```
- `password_hash`가 비어있는 유저는 누구나 `3700`으로 로그인됩니다. plan.md의 "실장이 직접 등록 + 초기 비번 3700" 구현 흔적인데, **지금은 is_approved=true 이고 password_hash가 null인 어떤 계정이든 3700으로 뚫립니다.** 공격자에게 단서가 되는 백도어.

### 5-4. **Supabase RLS(Row Level Security) 언급 없음**
- 현재 구조는 클라이언트가 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 직접 DB에 insert/select/update/delete를 합니다.
- Supabase는 기본적으로 RLS가 꺼져있으면 **anon 키로 모든 행에 접근 가능**. 다른 강사의 시험 데이터를 삭제·조회할 수 있고, 심지어 `users` 테이블을 업데이트해 역할을 바꿀 수 있습니다.
- 스키마 파일에 `enable row level security` 구문이 없음 → 지금 그대로 서비스하면 **한 명이 전체를 지울 수 있음**.

### 5-5. **.env.local의 키가 이번 대화 맥락에 보임**
- 파일은 `.gitignore`에 포함되어 있어 Git에는 안 올라가지만, 이 프로젝트를 누구에게 공유하거나 제 컨텍스트에 노출된 시점에 **이미 키 4개가 외부에 드러난 상태**로 봐야 합니다.
- 대응: Google AI Studio에서 4개 키 전부 **Revoke 후 재발급** 권장.

### 5-6. **역할 선택 프론트 분기**
- 로그인 후 `user.role === 'admin' ? '/admin' : '/teacher'` 로 라우팅. role은 DB에서 가져오지만, 위에서 말한 대로 **클라이언트 단에서 role을 조작**하면 끝.

---

## 6. 🟠 기능 버그/논리 오류

### 6-1. **킬러문항 `number` 변경 시 손풀이 이미지가 고아 파일이 됨**
- 업로드 경로가 `solutions/${examId}/q${questionNumber}_${Date.now()}.ext`.
- 강사가 킬러문항 번호를 8→10으로 수정해도 이미 업로드된 파일 경로는 `q8_...`. 이름은 그대로, DB에는 새 번호로 저장 → 나중에 파일 추적 불가.

### 6-2. **"AI 재분석" 버튼이 가짜**
`ExamAnalysis.tsx:195-202`
```
async function reanalyzeQuestion(idx) {
  setReanalyzingIdx(idx)
  try { await new Promise(r => setTimeout(r, 1500)) } // ← 실제 호출 없음
  finally { setReanalyzingIdx(null) }
}
```
- 스피너만 1.5초 돌고 끝. 사용자는 "재분석 됐다"고 오해.

### 6-3. **주간 쿼터 우회 가능**
- `getRecentAnalysisCount`가 `exams` 테이블에 생성된 건수만 보고 계산.
- 분석 요청(`/api/analyze`)은 통과했지만 `createExam` 저장을 건너뛰면 **카운트 안 됨** → 브라우저로 요청 중단해도 AI 호출은 이미 일어남(비용 소모).
- 또한 쿼터 체크는 **클라이언트 JS에서**만 함. 서버 API(`/api/analyze`)에 가드 없음 → 페이지를 안 거치고 `/api/analyze`를 직접 때리면 무한 호출 가능.

### 6-4. **주간 쿼터 기간 계산 미묘한 버그**
- `startDate = resetAt > weekAgo ? resetAt : weekAgo`.
- 관리자가 "분석횟수 초기화"를 눌러 `analysis_count_reset_at = now`로 만들면 이후 **그 시점 이후 분석 전부가 다시 카운트**되어 0부터 시작. 의도한 동작일 수 있으나, 주당 쿼터 의미와 섞여 혼란.

### 6-5. **업로드된 `temp-exams/` 파일이 영원히 남음**
- `teacher/upload/page.tsx`에서 시험지를 `temp-exams/` 경로에 업로드하고 그 URL을 `/api/analyze`에 넘김.
- 분석 끝나도 **지워지지 않음**. Supabase Storage 용량이 계속 증가 → 유료 구간 진입.
- `exam_files` 테이블에 `delete_after` 컬럼만 있고 삭제 크론도 없음.

### 6-6. **Storage upsert의 의미가 없음**
- 경로에 `Date.now()_random`이 들어가 **경로가 매번 유일** → `upsert: true`는 장식. 오히려 코드 의도가 애매해짐.

### 6-7. **`deleteUser`가 스토리지 파일을 안 지움**
- 강사 삭제 시 `exams` 행만 삭제. 그 강사가 업로드한 시험지/손풀이 파일은 `exam-files` 버킷에 잔존.

### 6-8. **`createSignup`의 아이디 중복 체크 경쟁 조건**
- 순서가 ① select 로 체크 → ② insert. 두 유저가 동시에 같은 아이디로 가입 신청하면 체크는 둘 다 통과, insert는 둘 중 하나만 실패(unique 제약). 에러 메시지가 "가입 실패: duplicate key..." 로 노출되어 사용자 경험 나쁨.
- **해결**: DB의 unique constraint 에러를 잡아 친절한 메시지로 바꿔야 함 (이미 유니크 제약은 있으니 기능상 치명은 아님).

### 6-9. **국어/영어는 대단원/중단원 구분이 이상함**
- `ExamAnalysis.tsx:39`
  ```
  const SOURCE_SUBJECTS = ['국어', '영어']
  ```
  국어·영어일 때 **중단원 컬럼 자체를 숨김**(`!isSourceSubject` 분기). 그래서 국어/영어 시험의 `subUnit`은 사용자가 보지도, 편집하지도 못함. 그런데 Gemini 프롬프트는 `subUnit`을 내놓으라고 지시. 결과: 차트 중에는 subUnit이 필요한데 숨겨진 값이 그대로 들어감. 혼란.
- 더 혼란스러운 점: Recharts의 "중단원별 분석" 패널이 `isMath` 분기로 국어/영어일 때는 대신 '출제자 의도별'을 보여주는데, 그럼 "subUnit" 값은 어디에서도 UI 노출이 없음.

### 6-10. **"텍스트 복사" 버튼이 강사 모드에서 안 보임**
- 코드 상 `mode !== 'teacher'` 일 때만 복사 버튼 노출. 실장 전용 기능. 문서(plan.md)와 상충하는지는 확인 필요. 강사에게 필요 없다면 정상이나, **UX 관점에서 알려주는 안내가 없음**.

### 6-11. **`handleFinalize` 후에도 수정 가능**
- `finalizeExam`만 호출 → `is_finalized=true`로 바뀜. 그러나 강사 화면에서 폼은 그대로 편집 가능(`handleSave` 버튼도 활성). 상태로는 "제출 완료"라고 뜨지만 실제 편집 차단 없음. 의도와 괴리.

### 6-12. **`handlePublish`의 blog_content 빈값**
- `publishExam(examDbId, '')` → 빈 문자열 저장. 나중에 블로그 복사 기능을 만들 때 여기가 발목.

### 6-13. **분석 결과 JSON에 `source`가 없음**
- Gemini Phase 1 프롬프트를 보면 응답에 `source` 필드를 요구하지 않습니다. 그런데 출처 분포 차트(`getSourceData`)는 `source`를 참조 → **거의 항상 "미입력"**으로 채워진 차트만 나옴.

### 6-14. **추출 JSON에 `source`·`region`·`workTitle`·`detailType` 등 타입은 있지만 프롬프트에 요청 없음**
- `types.ts`의 `ExamQuestion`은 이들 필드를 선언하지만 실제 분석은 mainUnit/subUnit/intent/rate/difficulty/score만 뽑음. 타입이 코드 구현을 앞서 감.

### 6-15. **`next.config.ts`의 `api.bodyParser`는 Pages Router 설정**
- App Router(이 프로젝트가 쓰는 방식)에서는 `api.bodyParser`가 **무시**됩니다. TypeScript가 `as NextConfig` 형 변환으로 억지로 받고 있을 뿐, 실제로는 동작 안 함.
- App Router에서 바디 크기 한도를 늘리려면 `experimental.serverActions.bodySizeLimit`는 Server Actions용이고, Route Handler(`/api/analyze`)는 **기본 1MB**를 받음.
- 현재 이 API는 JSON 바디 안에 URL만 담아 보내기 때문에 바디가 작아서 **실제론 문제없이 동작 중**일 뿐, 설정은 잘못되어 있음.

### 6-16. **Vercel `maxDuration: 60` 초 한도가 위험**
- 이미지 10장을 Google Generative에 각 키로 병렬 호출 + Phase 2 합산. 느린 날은 60초 초과 → 502 타임아웃.
- `route.ts`도 `export const maxDuration = 60`으로 명시. 상한이 같음. 실제 서비스에선 재시도 안내가 없으면 사용자 경험 나쁨.

### 6-17. **Phase 1 결과 에러 처리 누락**
- `runStage`가 모든 키에서 실패하면 `throw lastError`. 상위 `Promise.all`은 **하나만 실패해도 전부 실패**. 즉 키 1개 막히면 전체 분석 실패.
- `Promise.allSettled`로 바꿔 부분 성공도 수용하는 편이 안전.

### 6-18. **AI가 뱉은 JSON에 `score`가 `"-"` 문자열 vs 숫자인지 불일치**
- 프롬프트: `"score": "배점 숫자 또는 \"-\""` (문자열).
- 저장 시 타입: `number | string`.
- blog-html, 차트에서 문자열·숫자 혼용. 합계 계산 시 `isNaN`만 보고 넘기는데 `"4"` 같은 문자열 배점은 숫자로 안 더해짐. 잠재 버그.

### 6-19. **한글/ASCII 혼재로 URL 인코딩 위험**
- 파일명이 한글("시험지1.jpg")일 때 Storage 업로드 경로에 그대로 들어감. 그 뒤 `getPublicUrl` → Fetch 시 인코딩 처리는 Supabase가 하지만, `urlToBase64` 내부 `fetch(url)`이 한글 포함 URL을 제대로 처리하는지 환경(Vercel Edge 등)에 따라 차이.

### 6-20. **분석 비동기인데 로딩 가드 없음**
- 업로드 페이지에서 `setLoading(true)` 이후 네트워크 응답까지 60초 넘게 걸릴 수 있는데 사용자에게 **취소 버튼이 없음**. 실수로 업로드한 경우 AI 비용만 나감.

### 6-21. **ExamAnalysis.tsx의 `Suspense`가 의미 없음**
- `useEffect` 안의 `import()`는 Suspense와 무관. **fallback UI가 절대 뜨지 않음.** 겉멋.

### 6-22. **가입 시 `is_active`, `is_approved` 기본값 의존**
- `createSignup`에서 `is_approved: false`만 명시, `is_active`는 DB 기본값(true)에 의존. 스키마와 코드가 함께 움직이지 않으면 조용히 깨짐.

### 6-23. **관리자 대시보드 "posts" 탭 `badge` 계산**
- `waiting.length` 배지로 빨간 동그라미 표시하는데 그게 전체 대기 건수가 아니라 **필터가 적용된 후** 카운트. 필터 걸면 배지가 작아지는 비직관적 UX.

### 6-24. **`subject_change_requests` 테이블은 있는데 UI 진입점이 없다**
- 스키마·db.ts 함수 존재. 그러나 강사가 과목 변경을 신청하는 화면도, 관리자가 승인하는 UI도 실제 페이지에 없음. 죽은 피처.

---

## 7. 🟡 성능/비용 리스크

1. **`getExams`에 페이지네이션 없음.** 수백 건 쌓이면 대시보드가 매우 느려짐.
2. **이미지 1장당 Phase 1 호출 비용.** 10장 업로드하면 Phase 1에서 3~4장씩 묶여 3~4번 Gemini 호출. Phase 2까지 합해 매 분석마다 약 4번 호출 × 평균 입력 이미지 토큰. 한 강사가 주 3회 × 20명이면 비용 급증.
3. **`temp-exams/` 무한 증가**(앞서 언급).
4. **파일 검증 없이 업로드 받음.** 10MB PDF를 그대로 올리고 Gemini에 넘기면 토큰 사용량/시간 모두 폭주.
5. **전문/요약 프롬프트 중복.** `SUBJECT_PROMPT` + `baseContext`가 Phase 1/Phase 2 둘 다에 포함. Phase 2에 `allQuestions`까지 합치면 입력 토큰 큼.
6. **블로그 `generateBlogHtml`이 인라인 스타일 HTML을 만들지만, 긴 지면**. 네이버 블로그가 이 HTML을 100% 재현할지 미리 테스트 필요.

---

## 8. 🟢 코드 품질/유지보수 이슈

1. **`any` 남발.** admin/page.tsx 등 핵심 목록 데이터의 타입을 전부 `any[]`로 선언. 타입 안전성 포기.
2. **`ExamAnalysis.tsx`가 1160줄 단일 컴포넌트.** 섹션별(출제현황, 차트, 총평, 킬러, 적중, 전략)로 분리해야 유지보수 가능.
3. **`DUMMY`라는 이름의 기본값.** 실제 운영용 기본 state인데 이름이 개발 흔적.
4. **`console.error`는 있지만 **로깅/알림** 없음.** Vercel 로그에만 남고 실장에게는 안 감.
5. **텍스트 하드코딩.** "가입 신청 완료!" 같은 문구가 곳곳에 박힘. i18n 고려 제로.
6. **`import('@/lib/db')` 동적 임포트를 남발.** 필요 이유가 명확하지 않음(번들 크기 최적화 의도면 설명 주석 필요). 대부분은 정적 import로 충분.
7. **CLAUDE.md는 `@AGENTS.md`만 1줄.** AGENTS.md는 "이 Next.js는 네가 아는 것과 다르다"만 말함. 실제 프로젝트 설명 부재.
8. **ESLint 설정은 있지만 `any`·미사용 import 방치.**
9. **`@typescript-eslint/no-explicit-any` 를 파일마다 주석으로 끔.** 기술부채.
10. **Analysis 저장 구조가 뻣뻣함.** `analysis` JSONB 안에 `sectionComments`, `hitQuestions`까지 뭉쳐 넣음. 스키마 변경 시 JSON 구조를 해석해야 해서 마이그레이션 까다로움.

---

## 9. 📸 요약 위험도 매트릭스

| 구분 | 이슈 | 심각도 | 즉시 서비스 장애? |
|---|---|---|---|
| 스키마 | password_hash/analysis_count_reset_at/api_key_status/blog_content/exam-files 버킷 누락 | 🚨🚨🚨 | 예 |
| AI | `gemini-3-flash-preview` 존재하지 않음 | 🚨🚨🚨 | 예 |
| 보안 | localStorage만으로 인증 | 🚨🚨🚨 | 예(보안) |
| 보안 | 비밀번호 평문, `3700` 백도어 | 🚨🚨🚨 | 예(보안) |
| 보안 | RLS 미정의 | 🚨🚨🚨 | 예(보안) |
| 기능 | AI 재분석 가짜 | 🟠 | 아니오 |
| 기능 | source 필드 수집 안 함 → 차트 의미 없음 | 🟠 | 아니오 |
| 기능 | `handleFinalize` 후 편집 차단 없음 | 🟠 | 아니오 |
| 비용 | temp-exams 무한 증가, 쿼터 서버측 미검증 | 🟠 | 아니오 |
| 코드 | lib/gemini.ts·blog-html.ts 죽은 코드 | 🟡 | 아니오 |
| UX | 국어/영어 subUnit UI 미노출 | 🟡 | 아니오 |
| 배포 | bodyParser·maxDuration 설정 오해 | 🟡 | 부분 |

---

## 10. 🛠️ "충돌 없이 돌아가게" 만드는 재설계 (코드 없음, 설계만)

> 여기서부터는 **어떻게 고치면 서로 충돌 없이 동작하는지**를 설계 중심으로 정리합니다. 코드는 남기지 않고, 무엇을 정의해야 하는지·의존관계는 어떻게 되는지를 다룹니다. 실제로 고치기 전에 사용자가 **선택지**를 직접 고르셔야 할 지점도 함께 표시했습니다.

### 단계 A. DB 스키마와 코드 정렬 (가장 먼저)

#### A-1. users 테이블 보강
- `password_hash text` 추가.
- `analysis_count_reset_at timestamptz` 추가(기본 null 또는 가입 시각).
- `first_login_completed`는 이미 있으므로 그대로 활용 or 미사용이면 삭제.

#### A-2. exams 테이블 보강
- `blog_content text` 추가(빈 문자열 기본값).

#### A-3. api_key_status 테이블 신규 생성
- 컬럼: `key_index int primary key`, `last_used_at timestamptz`, `last_quota_error_at timestamptz`.
- 초기 행 4개(0,1,2,3) 미리 insert.

#### A-4. Storage 버킷 준비
- Supabase 대시보드에서 `exam-files` 버킷 생성 (Public read).
- 정책(Policy): 업로드는 인증된 사용자만, 읽기는 공개 또는 실장 한정(§B 참고).

#### A-5. RLS(행 수준 보안) 설계
아래는 권장안. 실제 적용 방식은 **사용자 선택 필요**:
- 선택지 1: **서버 라우트 경유 구조로 전면 전환** (권장, 하지만 구현량 많음)
  - 모든 DB 읽기/쓰기를 `/api/*` route handler에서 **Service Role Key**로 수행 → 브라우저에서는 anon key를 쓰지 않고 쿠키 세션만 사용.
- 선택지 2: **Supabase Auth 도입 + RLS** (중간 난이도)
  - Supabase Auth로 로그인 처리. RLS 정책: 강사는 본인 `teacher_id`만 select/update 가능, 관리자는 전부 가능, `users` 테이블은 관리자만 수정 가능.
- 선택지 3: **현 구조 유지 + 최소 RLS** (임시방편, 권장 X)
  - `users`는 관리자 API 경유로만 수정. 강사 토큰을 얻는 절차 추가.

→ **사용자가 1/2/3 중 선택 필요**. "1번"이 보안상 가장 깔끔하지만 코드량이 큽니다.

### 단계 B. 인증 재설계

#### B-1. 세션 구조
- 로그인 성공 시 서버에서 세명사항을 **HTTP-only 쿠키**로 발급(JWT 또는 Supabase Auth 세션).
- 클라이언트에서는 `localStorage.currentUser`를 **순전한 표시용 캐시**로만 사용하고, 진짜 권한 검증은 서버에서 매 요청마다 쿠키로.

#### B-2. 비밀번호
- bcrypt 또는 Supabase Auth의 내장 해시 사용. 평문 비교 제거.
- 마이그레이션: 기존 평문 값은 "강제 재설정" 대상(다음 로그인 시 변경).
- `3700` 백도어 **완전 제거**. 임시 비번 방식이 꼭 필요하면, 실장이 강사 계정에 **일회용 토큰**을 발급하고 강사가 첫 로그인 때 새 비번 설정(`first_login_completed`를 여기서 활용).

#### B-3. 서버측 가드
- `/teacher/**`, `/admin/**` 페이지마다 `middleware.ts` 또는 서버 컴포넌트에서 **쿠키 세션 검증 + 역할 확인**.
- `/api/analyze`도 인증 + 쿼터 체크(서버측).

### 단계 C. Gemini 호출 정리

#### C-1. 모델 선택
- **사용자 선택 필요**: 어느 모델을 쓰실지
  - 선택지 a. `gemini-2.5-flash` — 빠르고 저렴, OCR 품질 양호
  - 선택지 b. `gemini-2.5-pro` — 품질 최상, 느리고 비쌈
  - 선택지 c. `gemini-2.0-flash` — 저렴, 품질은 2.5-flash보다 낮음
- 정식 모델명 확정 후 `/api/models` 엔드포인트로 내 키가 실제 지원하는지 확인 → 상수로 고정.

#### C-2. 코드 통합
- `lib/gemini.ts`를 단일 소스로 승격, `route.ts`는 그것만 import.
- 죽은 중복 코드(상수/함수) 제거.

#### C-3. Phase 1 부분 실패 허용
- `Promise.all` → `Promise.allSettled`. 실패 청크는 건너뛰고, 사용자에게 "일부 이미지 분석 실패, 수동 입력 필요" 피드백.
- 아니면 실패 청크만 다른 살아있는 키로 한 번 더 재시도.

#### C-4. 프롬프트에 `source` 요구
- Phase 1 스키마에 `source`를 반드시 포함시켜야 차트가 의미 있음. 예: "교과서 | 부교재 | 모의고사 | 학습지 | 모름" 분류.

#### C-5. 시간 상한 관리
- `/api/analyze`의 `maxDuration`을 Vercel Pro 플랜의 300초까지 확장할지, 아니면 **즉시 응답 + 백그라운드 잡** 구조로 바꿀지 결정.
- **사용자 선택 필요**:
  - 선택지 a. 동기 호출 유지(Pro 플랜 또는 작은 이미지 수 제한)
  - 선택지 b. 큐 도입(Supabase Edge Functions + Database Webhook, 또는 Upstash QStash 등) → 분석 완료 시 실시간 알림

### 단계 D. Storage 관리

#### D-1. 파일 관리
- 업로드 시 **원본 레코드를 `exam_files` 테이블에 항상 기록**(`delete_after` 채우기).
- 분석 완료 후 `temp-exams/` 파일은 24시간 뒤 자동 삭제(크론).
- 킬러문항 손풀이는 `solutions/<examId>/<fileId>.ext`로 경로 안정화 → 번호 수정해도 끊기지 않음.

#### D-2. Storage 정책
- 버킷 RLS:
  - 강사: 본인 examId 경로에만 업로드/읽기
  - 관리자: 전체 읽기
  - 외부: 기본 차단, 실장이 "블로그용"으로 플래그 세운 파일만 퍼블릭

### 단계 E. 쿼터 서버측 집행

- `/api/analyze`에 인증 + 쿼터 체크 삽입.
- 매 성공 시 "사용 횟수" 카운터 증가(또는 분석 시작 시 예약 증가 → 실패 시 롤백).
- 남은 횟수는 응답에 포함해 UI가 그대로 반영.

### 단계 F. UI/피처 정리

- **"AI 재분석" 버튼**: 실제 기능 구현(문항 1개만 재요청) or 버튼 제거. **사용자 선택 필요**.
- **국어/영어 `subUnit` UI**: 표시 or 제거. 표시 쪽으로 하려면 차트·표 열을 함께 복원.
- **"발행 처리" 흐름**: `generateBlogHtml`을 실제 호출 → 결과를 `blog_content`에 저장 → 관리자 상세 페이지에서 "HTML 복사" 버튼으로 노출.
- **과목 변경 신청**: 원래 계획인지 확인 후 UI 추가 or 테이블·함수 제거.
- **적중문제 섹션**: 업로드된 이미지 짝 자체를 Gemini가 비교 채점까지 할지, 단순 첨부로만 쓸지 **사용자 선택 필요**.

### 단계 G. 운영/관측

- **로깅**: `/api/analyze` 에러를 Sentry 또는 Supabase `logs` 테이블에 축적.
- **배포 설정**: `next.config.ts`의 `api.bodyParser` 제거(App Router에서 무의미). 필요 시 Route Handler 내부에서 바디 크기 검사.
- **.env.local 키 회전**: 이번 기회에 Gemini 키 4개, Supabase anon key 모두 재발급.

### 단계 H. 코드 정리

- `lib/gemini.ts` 단일화 후 `route.ts` 중복 제거.
- `blog-html.ts`는 발행 플로우에 연결 or 삭제.
- `ExamAnalysis.tsx`를 섹션별로 쪼개기 (출제현황 / 차트 / 총평 / 킬러 / 적중 / 전략 / 헤더).
- 타입: `any` 제거, `lib/types.ts` 기반으로 구체화.

---

## 11. 🔗 구현 순서 제안 (충돌 없는 작업 순서)

```
1) DB 스키마 정렬 (§A) → 먼저 해야 나머지 코드가 에러 없이 도는 전제.
      ↓
2) Gemini 모델명 확정 (§C-1)       ← 병렬로 진행 가능
      ↓
3) lib/gemini.ts 단일화 (§C-2, §H)
      ↓
4) 인증 구조 결정/구현 (§B) — 선택지 1/2/3에 따라 범위 달라짐
      ↓
5) 서버측 쿼터 (§E), Storage 정리 (§D)
      ↓
6) 프롬프트 보강 (§C-4), Phase 부분 실패 허용 (§C-3)
      ↓
7) UI 부채 정리 (§F, §H)
      ↓
8) 로깅/배포 설정 (§G)
```

각 단계는 **이전 단계를 깨지 않는다**는 원칙으로 설계되어 있습니다. 특히 (1) 스키마 정렬은 나머지를 전부 막고 있는 블로커라 반드시 1번.

---

## 12. ✅ 사용자에게 확인·선택 요청 목록

전역 원칙상 임의 결정을 피하기 위해, 아래는 제가 혼자 정할 수 없는 지점입니다. 재설계에 들어가기 전에 선택 부탁드립니다.

1. **보안 구조** — §A-5 / §B
   - [ ] ① 모든 DB 접근을 서버 라우트 경유 + Service Role Key (가장 안전, 코드 많이 바뀜)
   - [ ] ② Supabase Auth + RLS 도입 (중간)
   - [ ] ③ 현 구조 유지 + 최소 RLS (임시방편)

2. **Gemini 모델** — §C-1
   - [ ] a. `gemini-2.5-flash`
   - [ ] b. `gemini-2.5-pro`
   - [ ] c. `gemini-2.0-flash`
   - [ ] d. 기타 (직접 지정)

3. **분석 실행 방식** — §C-5
   - [ ] a. 현재처럼 동기 호출 유지 (Vercel Pro 플랜 또는 이미지 수 제한 필요)
   - [ ] b. 큐 기반 비동기(잡 큐 + 완료 알림)

4. **"AI 재분석" 버튼** — §F
   - [ ] a. 진짜 기능으로 구현
   - [ ] b. 버튼 제거

5. **국어/영어 subUnit 노출** — §F
   - [ ] a. 표·차트에 복원 노출
   - [ ] b. 아예 필드·프롬프트에서 제거

6. **`blog-html.ts` / 과목변경 신청 / 적중문제** — §F
   - 각 피처를 살릴지(구현 완성) 제거할지 판단 필요.

7. **DB 마이그레이션 방식** — §A
   - [ ] a. 빈 DB에서 새로 시작 (데이터 없음 가정)
   - [ ] b. 기존 데이터 보존 → ALTER 스크립트 별도 작성

8. **키 재발급** — §5-5 / §G
   - [ ] a. 지금 바로 4개 키 Revoke + 재발급
   - [ ] b. 일단 놔두고 나중에

---

## 13. 맺음말

이 코드는 **UI와 AI 프롬프트 설계 감각은 좋지만, 데이터 계약(스키마)·인증·실행환경(모델명/배포 설정) 세 축이 현실과 어긋나 있어 "실행이 안 되는 상태"에 가깝습니다.** 핵심은 아래 세 가지입니다.

1. **스키마 정렬이 가장 시급** — 이 한 판을 먼저 맞추면 "왜 안 되지?"의 대부분이 해소됩니다.
2. **Gemini 모델명을 실존 모델로 교체** — 지금 이름으로는 Gemini 쪽이 거절합니다.
3. **인증을 진짜로 구현해야** 서비스를 외부에 공개할 수 있습니다.

그 다음이 §10에서 정리한 여러 디테일입니다. 위 §12의 선택지에 답해 주시면, 다음 단계에서 그 선택에 맞춰 세부 설계·구현 계획을 제가 구체화해 드리겠습니다.

— 끝 —
