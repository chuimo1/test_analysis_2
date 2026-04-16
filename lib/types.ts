export type UserRole = 'teacher' | 'admin'

export type Subject = '국어' | '영어' | '수학' | '사회'

export type Grade = '중1' | '중2' | '중3' | '고1' | '고2' | '고3'

export type Difficulty = '상' | '중상' | '중' | '중하' | '하'

export type QuestionType = '객관식' | '단답형' | '서술형'

export type SourceCategory = '교과서' | '부교재' | '모의고사' | '학습지' | '직접입력'

export interface User {
  id: string
  userId: string
  name: string
  phone: string
  role: UserRole
  subject?: Subject
  isApproved: boolean
  isActive: boolean
  firstLoginCompleted: boolean
  createdAt: string
}

export interface ExamQuestion {
  number: number
  type: QuestionType
  source: string
  sourceDetail?: string

  mainUnit?: string
  subUnit?: string

  region?: string

  workTitle?: string

  detailType?: string

  intent: string
  expectedCorrectRate: number
  difficulty: Difficulty
  score: number | string
}

export interface ExamScopeItem {
  category: SourceCategory
  detail: string
}

export interface KillerQuestion {
  questionNumber: number
  unit: string
  intent: string
  difficulty: Difficulty
  expectedCorrectRate: number
  reason: string
  solutionImageUrl?: string
}

export interface StrategyItem {
  trend: string
  strategy: string
}

export interface ExamAnalysis {
  id: string
  examId: string
  teacherId: string
  subject: Subject
  grade: Grade
  examYear: number
  examTerm: string
  school: string

  examScope: ExamScopeItem[]
  expectedDifficulty: Difficulty
  teacherNote: string

  questions: ExamQuestion[]
  overallDifficulty: Difficulty
  keyFeatures: string[]
  yearOverYearComparison: string
  killerQuestions: KillerQuestion[]
  nextExamStrategy: StrategyItem[]

  blogContent: string
  blogPublishedAt?: string

  isFinalized: boolean
  createdAt: string
  updatedAt: string
}

export interface Exam {
  id: string
  teacherId: string
  subject: Subject
  grade: Grade
  school: string
  examYear: number
  examTerm: string
  examScope: ExamScopeItem[]
  expectedDifficulty: Difficulty
  teacherNote: string
  currentExamImages: string[]
  previousExamImages: string[]
  analysis?: ExamAnalysis
  createdAt: string
}

export interface SubjectChangeRequest {
  id: string
  userId: string
  currentSubject: Subject
  requestedSubject: Subject
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export type AnalysisStage = 'questions' | 'summary' | 'killers' | 'strategy'

export interface AnalysisStageStatus {
  stage: AnalysisStage
  status: 'pending' | 'success' | 'failed'
  error?: string
}
