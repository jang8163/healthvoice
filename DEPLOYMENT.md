# HealthVoice 배포 가이드

## Vercel을 통한 배포

### 1. Vercel 계정 생성 및 GitHub 연동
1. [Vercel.com](https://vercel.com)에 접속하여 계정을 생성하세요
2. GitHub 계정으로 로그인하세요
3. "New Project"를 클릭하세요

### 2. 프로젝트 배포
1. GitHub 저장소 목록에서 `jang8163/healthvoice`를 선택하세요
2. "Import"를 클릭하세요
3. 프로젝트 설정:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (기본값)
   - **Build Command**: (비워두기 - 정적 파일이므로)
   - **Output Directory**: `./` (기본값)
4. "Deploy"를 클릭하세요

### 3. 도메인 설정
- Vercel이 자동으로 `https://healthvoice-xxx.vercel.app` 형태의 도메인을 생성합니다
- 커스텀 도메인을 원한다면 Vercel 대시보드에서 설정할 수 있습니다

### 4. 자동 배포 설정
- GitHub에 코드를 푸시할 때마다 자동으로 재배포됩니다
- `main` 브랜치에 푸시하면 프로덕션 환경에 자동 배포됩니다

## PWA 기능 확인
배포 후 다음 기능들이 정상 작동하는지 확인하세요:
- [ ] 웹사이트가 HTTPS에서 접속 가능
- [ ] Service Worker가 정상 등록됨
- [ ] PWA 설치 프롬프트가 나타남
- [ ] 오프라인에서도 기본 기능 작동
- [ ] 음성 인식 기능 작동

## 문제 해결
- **Service Worker 오류**: 브라우저 개발자 도구의 Application 탭에서 확인
- **음성 인식 오류**: HTTPS 환경에서만 작동하므로 확인 필요
- **PWA 설치 오류**: manifest.json과 Service Worker가 정상 등록되었는지 확인

## 성능 최적화
- Vercel의 CDN을 통해 전 세계에서 빠른 로딩
- 자동 HTTPS 적용
- 브라우저 캐싱 최적화
