# 카페24 메인 도메인 후속 적용

2026-10-12 공개 HTML 확인 기준:
- https://brand-er.store/ 는 GitHub Pages 앱을 iframe으로 표시한다.
- 메인에는 canonical과 Open Graph 태그가 중복되어 있다.
- /custom/index.html 에는 / 와 /custom/index.html 을 가리키는 서로 다른 canonical이 함께 있다.
- 메인 도메인 sitemap은 카페24 상품·게시판 위주이며 앱 제작 안내를 포함하지 않는다.

GitHub 배포는 카페24 HTML과 도메인 설정을 변경하지 않는다. 아래 작업은 카페24 디자인 편집 권한으로 별도 적용해야 한다.

1. 메인 레이아웃과 개별 페이지에서 SEO 메타태그를 중복 출력하는 곳을 정리한다. 메인 canonical은 https://brand-er.store/ 하나만 남긴다. custom 페이지가 메인과 다른 실제 콘텐츠라면 해당 페이지 자신의 canonical을 하나만 남기고, 같은 콘텐츠라면 메인으로 통일한다.
2. iframe 바깥에 아래 snippet.html의 **보이는** 서비스 소개·안내 링크를 배치한다. 숨김 텍스트나 검색봇 전용 콘텐츠로 만들지 않는다. 고정 전체화면 iframe 스타일은 콘텐츠가 함께 보이도록 수정해야 한다. 기존 로그인·결제 iframe 메시지 처리는 보존한다.
3. 더 좋은 최종 구조는 서비스 소개/FAQ HTML을 brand-er.store 자체 경로에서 응답하도록 제공하는 것이다. 실제 배포한 뒤에만 해당 페이지 canonical과 내부 링크를 그 경로로 변경한다. 아직 존재하지 않는 brand-er.store/guides URL을 등록하지 않는다.
4. Search Console에서 실제 공개된 GitHub Pages 안내 페이지 sitemap을 해당 URL-prefix 속성으로 제출한다: https://brand-er1.github.io/clothology-express/sitemap.xml . brand-er.store의 URL-prefix 속성과 섞지 않는다. 메인 도메인에 안내 페이지를 올리는 경우 해당 도메인의 sitemap에 실제 URL을 추가한다.
5. 페이지 URL 검사로 공개 HTML, canonical 선택과 색인 가능 여부를 확인한다. 색인·AI 인용과 추천은 보장되지 않는다.

소스: Google Search Central, AI features and your website
https://developers.google.com/search/docs/appearance/ai-features

특수 AI 전용 파일이나 특별한 Schema가 필수인 것은 아니다. 공개된 텍스트, 내부 링크, 정확한 구조화 데이터와 실제 접근 가능한 URL을 우선한다. FAQ 리치 결과 노출을 약속하지 않는다.
