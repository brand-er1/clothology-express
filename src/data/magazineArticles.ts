/**
 * BRAND-ER 매거진(/community) 상단 "BRAND-ER NEWS" 섹션에 노출되는 기사 목록.
 *
 * - type "external": 외부 언론 보도. 카드 전체가 externalUrl을 새 탭으로 연다.
 * - type "internal": 사이트 내부 콘텐츠. externalUrl에 내부 경로("/...")를 넣으면 같은 탭에서 이동한다.
 * - publishedAt은 ISO 날짜(YYYY-MM-DD). 화면에는 최신순으로 정렬되어 "YYYY.MM.DD"로 표시된다.
 */
export type MagazineArticleType = "internal" | "external";

export type MagazineArticle = {
  title: string;
  thumbnail: string;
  publisher: string;
  /** ISO 날짜 문자열 (YYYY-MM-DD) */
  publishedAt: string;
  summary: string;
  externalUrl: string;
  type: MagazineArticleType;
};

export const magazineArticles: MagazineArticle[] = [
  {
    title: "“18세부터 시작된 창업 도전”… BRAND-ER 김하성 대표, AI로 패션 산업의 문턱을 낮추다",
    summary:
      "구매대행과 의류 쇼핑몰 운영 경험에서 발견한 제작 현장의 문제를 AI 기반 의류 프로모션 플랫폼으로 해결해 온 김하성 대표의 창업 이야기입니다.",
    thumbnail: "https://cdn.newsfinder.co.kr/news/thumbnail/202606/220437_225168_1236_v150.jpg",
    publisher: "뉴스파인더",
    publishedAt: "2026-06-06",
    externalUrl: "http://www.newsfinder.co.kr/news/articleView.html?idxno=220437",
    type: "external",
  },
  {
    title: "AI 의류 프로모션 기업 브랜더, 라사라·루아트 패션학교와 협력 확대",
    summary:
      "패션 교육기관과의 협력을 통해 학생들의 졸업작품 제작과 브랜드 론칭을 지원하고, 신진 디자이너의 생산 진입장벽을 낮추는 BRAND-ER의 행보를 소개합니다.",
    thumbnail: "https://cdn.gokorea.kr/news/thumbnail/202606/870763_147910_389_v150.jpg",
    publisher: "공감신문",
    publishedAt: "2026-06-30",
    externalUrl: "https://www.gokorea.kr/news/articleView.html?idxno=870763",
    type: "external",
  },
  {
    title: "디큐베이터, ‘DeXplore 글로벌 청년 창업 아이디어 경진대회’ 성료…우수팀 사업화 지원",
    summary:
      "대학생 창업팀 11개 팀이 참여한 글로벌 청년 창업 아이디어 경진대회의 수상 결과와 후속 사업화 지원 계획을 다룬 기사로, BRAND-ER가 수상팀으로 소개됐습니다.",
    thumbnail: "https://www.thevaluenews.co.kr/data/cheditor4/2502/bbed3bf147bcaac8670b45d4acc6ad4716634ce2.png",
    publisher: "더밸류뉴스",
    publishedAt: "2025-02-06",
    externalUrl: "https://www.thevaluenews.co.kr/news/view.php?idx=188400",
    type: "external",
  },
  {
    title: "브랜더(BRAND-ER), AI 기반 의류 디자인·자동견적·상표분석으로 패션 창업 혁신",
    summary:
      "디자인 생성부터 제작 견적과 상표 분석까지 한곳에서 제공하는 BRAND-ER의 서비스를 소개하며, AI 자동견적 시스템의 특허 출원을 준비 중인 소식을 전합니다.",
    thumbnail: "https://cdn.newsfinder.co.kr/news/thumbnail/202608/221368_226384_5731_v150.jpg",
    publisher: "뉴스파인더",
    publishedAt: "2026-08-02",
    externalUrl: "http://www.newsfinder.co.kr/news/articleView.html?idxno=221368",
    type: "external",
  },
  // TODO(유튜버월드): https://youtuberworld.co.kr/View.aspx?No=4253327
  // 작업 환경에서 원문 접근이 차단되어 실제 제목·대표 이미지·게재일을 확인하지 못했습니다.
  // 원문에서 확인한 값으로 아래 항목을 채운 뒤 주석을 해제하세요(값을 추측해서 넣지 마세요).
  // {
  //   title: "",
  //   summary: "",
  //   thumbnail: "",
  //   publisher: "",
  //   publishedAt: "YYYY-MM-DD",
  //   externalUrl: "https://youtuberworld.co.kr/View.aspx?No=4253327",
  //   type: "external",
  // },
];

/** "2026-06-06" → "2026.06.06" */
export const formatMagazineDate = (isoDate: string) => isoDate.replace(/-/g, ".");

/** publishedAt 기준 최신순 정렬 (원본 배열은 변경하지 않음). */
export const sortMagazineArticles = (articles: MagazineArticle[]) =>
  [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
