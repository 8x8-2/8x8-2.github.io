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

## 6. 프로필 저장 시 정적 프로필 자동 갱신

프로필 페이지의 OG 메타와 정적 SEO HTML은 GitHub Pages 빌드 시점에 다시 생성됩니다. 이제 프로필 저장 후에도 자동으로 재빌드가 예약되도록 아래 설정을 추가합니다.

### 6-1. Supabase Edge Function 배포

아래 함수를 배포합니다.

- `trigger-pages-rebuild`

예시:

```bash
supabase functions deploy trigger-pages-rebuild
```

### 6-2. Supabase Edge Function 환경 변수 설정

Supabase 프로젝트에 아래 환경 변수를 추가합니다.

- `GITHUB_REBUILD_TOKEN`
- `GITHUB_REPOSITORY`
- `GITHUB_DEPLOY_WORKFLOW` (선택, 기본값 `deploy-pages.yml`)
- `GITHUB_DEPLOY_REF` (선택, 기본값 `main`)

권장값:

- `GITHUB_REPOSITORY=8x8-2/8x8-2.github.io`
- `GITHUB_DEPLOY_WORKFLOW=deploy-pages.yml`
- `GITHUB_DEPLOY_REF=main`

`GITHUB_REBUILD_TOKEN` 은 GitHub Actions 워크플로를 실행할 수 있는 토큰이어야 합니다. 가장 간단한 방법은 저장소 접근이 가능한 GitHub PAT를 사용하는 것입니다.

예시:

```bash
supabase secrets set \
  GITHUB_REBUILD_TOKEN=ghp_xxx \
  GITHUB_REPOSITORY=8x8-2/8x8-2.github.io \
  GITHUB_DEPLOY_WORKFLOW=deploy-pages.yml \
  GITHUB_DEPLOY_REF=main
```

### 6-3. 동적 정보와 정적 정보의 차이

- 팔로워 수, 팔로잉 수, 팔로우 여부 같은 값은 페이지에 들어갈 때마다 Supabase에서 동적으로 다시 불러옵니다.
- 공유 미리보기(OG 이미지/제목/설명)와 정적 SEO HTML은 GitHub Pages 재빌드가 끝난 뒤 반영됩니다.

즉, 프로필 저장 직후 화면 내용은 바로 최신으로 보일 수 있지만, 카카오톡/슬랙 등에서 보이는 공유 미리보기는 보통 배포 완료까지 몇 분 정도 지연될 수 있습니다.
