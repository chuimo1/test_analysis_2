-- 품격에듀 Supabase 스키마
-- Supabase Studio > SQL Editor 에서 실행

create extension if not exists "uuid-ossp";

-- 1. 강사/관리자
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  user_id text unique not null,
  name text not null,
  phone text,
  role text not null check (role in ('teacher', 'admin')),
  subject text check (subject in ('국어', '영어', '수학', '사회')),
  is_approved boolean not null default false,
  is_active boolean not null default true,
  first_login_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists users_user_id_idx on users(user_id);
create index if not exists users_role_idx on users(role);

-- 2. 시험 + 분석 결과
create table if not exists exams (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references users(id) on delete set null,
  subject text not null,
  grade text not null,
  school text not null,
  exam_year int not null,
  exam_term text not null,

  exam_scope jsonb not null default '[]',
  expected_difficulty text,
  teacher_note text,

  analysis jsonb,

  is_finalized boolean not null default false,
  blog_published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exams_teacher_idx on exams(teacher_id);
create index if not exists exams_finalized_idx on exams(is_finalized);
create index if not exists exams_school_idx on exams(school);

-- 3. 시험지 파일 (자동삭제 대상)
create table if not exists exam_files (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid references exams(id) on delete cascade,
  file_url text not null,
  file_kind text not null check (file_kind in ('current', 'previous', 'solution')),
  uploaded_at timestamptz not null default now(),
  delete_after timestamptz
);

create index if not exists exam_files_delete_after_idx on exam_files(delete_after);

-- 4. 과목 변경 신청
create table if not exists subject_change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  current_subject text not null,
  requested_subject text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 5. updated_at 자동 갱신
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists exams_touch on exams;
create trigger exams_touch
before update on exams
for each row execute function touch_updated_at();
