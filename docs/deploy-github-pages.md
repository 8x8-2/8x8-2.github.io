# GitHub Pages 배포 메모

## 1. GitHub Actions 변수 등록

저장소 `Settings -> Secrets and variables -> Actions -> Variables` 에 아래 두 값을 추가합니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 2. GitHub Pages 배포 소스 설정

저장소 `Settings -> Pages` 에서 Source 를 `GitHub Actions` 로 바꿉니다.

## 3. 커스텀 도메인 확인

현재 도메인은 `stellar-id.com` 입니다. `Settings -> Pages` 에서 커스텀 도메인이 `stellar-id.com` 으로 설정되어 있는지 확인합니다.

## 4. Supabase Auth URL 설정

Supabase `Authentication -> URL Configuration` 에서 아래를 확인합니다.

- Site URL: `https://stellar-id.com`
- Redirect URLs:
  - `https://stellar-id.com/**`
  - `http://localhost:5173/**`

## 5. 배포

`main` 브랜치에 push 하면 `.github/workflows/deploy-pages.yml` 이 자동 실행됩니다.
