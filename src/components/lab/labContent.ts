import type { LucideIcon } from "lucide-react";
import { Clapperboard, ClipboardCheck, Lightbulb, Mic, PencilRuler, Scissors, Sparkles, Wand2 } from "lucide-react";

/**
 * BRAND-ER LAB 페이지 콘텐츠.
 *
 * FASHION KNOWLEDGE 카드는 카드를 누르면 상세 내용이 열리는 구조다. 릴스 · 매거진 글이 생기면
 * `reelUrl` · `links` 에 실제 주소를 넣으면 상세 창에 버튼이 자동으로 나타난다.
 * 확인되지 않은 주소는 넣지 않는다(비워 두면 '릴스 준비 중'으로 표시).
 */

export type LabKnowledgeLink = { label: string; href: string; external?: boolean };

export type LabKnowledgeItem = {
  id: string;
  /** 카드 위 작은 분류 */
  tag: string;
  title: string;
  /** 카드에 보이는 한 줄 요약 */
  summary: string;
  /** 상세 창 본문(문단) */
  body: string[];
  /** 상세 창 핵심 정리 */
  points: { term: string; text: string }[];
  /** 인스타그램 릴스 주소 (없으면 '준비 중') */
  reelUrl?: string;
  /** 사이트 안 관련 글 (앱 기준 경로) */
  links?: LabKnowledgeLink[];
};

export const LAB_KNOWLEDGE: LabKnowledgeItem[] = [
  {
    id: "cotton-vs-polyester",
    tag: "FABRIC",
    title: "면과 폴리에스터의 차이",
    summary: "부드러운 천연섬유와 튼튼한 합성섬유, 무엇이 다를까요?",
    body: [
      "면(코튼)은 목화에서 얻는 천연섬유입니다. 땀을 잘 흡수하고 촉감이 부드러워 피부에 닿는 티셔츠 · 맨투맨에 많이 쓰입니다. 대신 마르는 속도가 느리고, 세탁 후 줄어들거나 구김이 생기기 쉽습니다.",
      "폴리에스터는 석유에서 뽑아낸 합성섬유입니다. 가볍고 빨리 마르며 구김과 수축이 적어 운동복 · 단체복에 자주 쓰입니다. 흡습성이 낮아 땀이 차는 느낌이 들 수 있어, 기능성 가공을 하거나 면과 섞어(혼방) 단점을 보완합니다.",
    ],
    points: [
      { term: "면", text: "흡습성 · 촉감 우수 / 수축 · 구김 주의" },
      { term: "폴리에스터", text: "가볍고 빨리 마름 · 형태 유지 / 통기성은 낮은 편" },
      { term: "혼방(T/C 등)", text: "두 섬유를 섞어 촉감과 내구성을 함께 챙김" },
    ],
  },
  {
    id: "gsm",
    tag: "FABRIC",
    title: "GSM이란?",
    summary: "원단 두께를 숫자로 말하는 방법, GSM을 알아봅니다.",
    body: [
      "GSM(Grams per Square Meter)은 원단 1㎡의 무게를 그램으로 나타낸 값입니다. 같은 소재라면 숫자가 클수록 더 두껍고 묵직한 원단입니다.",
      "티셔츠를 예로 들면 160g 안팎은 얇고 가벼운 여름용, 200g 이상은 비침이 적고 탄탄한 '헤비 코튼' 느낌에 가깝습니다. 맨투맨 · 후드티는 보통 그보다 무거운 원단을 씁니다. 다만 같은 GSM이어도 짜임과 소재에 따라 체감 두께가 달라 실물 스와치로 확인하는 것이 가장 정확합니다.",
    ],
    points: [
      { term: "GSM", text: "원단 1㎡당 무게(g). 숫자가 클수록 두꺼움" },
      { term: "가벼운 원단", text: "통기성이 좋고 여름용에 적합" },
      { term: "무거운 원단", text: "비침이 적고 형태감이 탄탄함" },
    ],
  },
  {
    id: "screen-vs-transfer",
    tag: "PRINTING",
    title: "나염과 전사의 차이",
    summary: "옷에 그림을 입히는 대표적인 두 가지 방법.",
    body: [
      "나염(실크스크린)은 디자인 색상마다 판을 만들고, 판 위로 잉크를 밀어 원단에 직접 찍는 방식입니다. 잉크가 원단에 스며들어 내구성이 좋고, 같은 디자인을 많이 찍을수록 장당 단가가 내려갑니다. 대신 색이 많아질수록 판도 늘어납니다.",
      "전사는 디자인을 먼저 필름이나 전사지에 인쇄한 뒤 열과 압력으로 원단에 옮기는 방식입니다. 판이 필요 없어 소량 · 다색 · 사진 같은 그래픽에 유리합니다. 표면에 얇은 막이 생기는 방식이 많아 촉감과 내구성은 종류에 따라 다릅니다.",
    ],
    points: [
      { term: "나염(실크스크린)", text: "색상별 판 제작 · 대량에 유리 · 선명하고 튼튼함" },
      { term: "전사", text: "판 없이 열로 옮김 · 소량 · 다색 · 사진 그래픽에 유리" },
    ],
    links: [{ label: "실크스크린 · 전사 프린팅 방식 비교 가이드", href: "/guides/printing.html" }],
  },
  {
    id: "knit-vs-woven",
    tag: "FABRIC",
    title: "다이마루와 직기의 차이",
    summary: "늘어나는 원단과 늘어나지 않는 원단, 현장 용어로 알아봅니다.",
    body: [
      "다이마루는 실을 고리 모양으로 엮어 만든 편직물(니트 원단)을 현장에서 부르는 말입니다. 원형 편직기로 짜는 경우가 많아 붙은 이름으로, 잘 늘어나고 몸에 편안하게 붙어 티셔츠 · 맨투맨 · 후드티에 주로 쓰입니다.",
      "직기는 가로실과 세로실을 교차시켜 짠 직물(우븐 원단)을 말합니다. 거의 늘어나지 않아 형태가 반듯하게 유지되므로 셔츠 · 바지 · 재킷 같은 옷에 쓰입니다. 같은 디자인이어도 어떤 원단을 쓰느냐에 따라 패턴과 봉제 방법이 달라집니다.",
    ],
    points: [
      { term: "다이마루(편직물)", text: "신축성 좋음 · 티셔츠, 맨투맨, 후드티" },
      { term: "직기(직물)", text: "형태 안정 · 셔츠, 바지, 재킷" },
    ],
  },
  {
    id: "ura-omote",
    tag: "TERM",
    title: "우라와 오모테",
    summary: "원단의 안과 겉, 공장에서 쓰는 말로 알아봅니다.",
    body: [
      "의류 현장에서는 원단의 겉면을 '오모테', 안쪽 면을 '우라'라고 부르곤 합니다. 일본어에서 온 업계 용어로, 표준어로는 각각 '겉감(겉면)', '안감(안면)'이라고 하면 됩니다.",
      "겉과 안을 구분하는 것은 생각보다 중요합니다. 같은 원단이라도 면에 따라 색감 · 광택 · 촉감이 다르고, 맨투맨 원단처럼 안쪽에 고리(루프)나 기모가 있는 경우도 있습니다. 재단할 때 면을 헷갈리면 완성품의 색이나 느낌이 달라질 수 있어요.",
    ],
    points: [
      { term: "오모테", text: "원단의 겉면(바깥에 보이는 면)" },
      { term: "우라", text: "원단의 안쪽 면 또는 안감" },
    ],
  },
  {
    id: "production-process",
    tag: "PROCESS",
    title: "의류 제작 과정",
    summary: "아이디어가 옷이 되기까지 어떤 단계를 거칠까요?",
    body: [
      "옷 한 벌은 보통 디자인 기획 → 원단 · 부자재 선정 → 패턴 제작 → 샘플 제작 → 피팅 · 수정 → 본생산(재단 · 봉제 · 프린팅) → 검수 · 출고 순서로 만들어집니다.",
      "그중 샘플 단계는 머릿속 디자인을 처음으로 실물로 확인하는 순간입니다. 핏, 원단 느낌, 프린팅 위치와 크기를 직접 보고 고친 뒤에 본생산으로 넘어가야 실패를 줄일 수 있습니다. BRAND-ER LAB 무료 샘플 프로젝트도 바로 이 단계를 함께합니다.",
    ],
    points: [
      { term: "기획 · 원단", text: "디자인 방향과 소재 결정" },
      { term: "패턴 · 샘플", text: "실물로 처음 만들어 확인" },
      { term: "본생산", text: "확정된 샘플 기준으로 재단 · 봉제 · 프린팅" },
    ],
    links: [{ label: "의류 샘플 제작 기간 · 본생산 과정 가이드", href: "/guides/process.html" }],
  },
];

export type LabStep = { title: string; body: string; icon: LucideIcon };

export const LAB_STEPS: LabStep[] = [
  { title: "신청하기", body: "만들고 싶은 옷과 아이디어, 참고 이미지를 신청서로 보내주세요. 신청 비용은 없습니다.", icon: ClipboardCheck },
  { title: "아이디어 검토 및 선정", body: "BRAND-ER LAB 팀이 모든 신청을 검토해 제작할 프로젝트를 선정하고, 선정된 분께 개별 연락드립니다.", icon: Lightbulb },
  { title: "디자인 구체화", body: "원단, 컬러, 핏, 프린팅 · 자수 위치 등을 함께 정리해 실제 제작 가능한 디자인으로 다듬습니다.", icon: PencilRuler },
  { title: "의류 샘플 제작", body: "패턴 제작부터 재단 · 봉제 · 프린팅까지, 브랜더의 제작 공정으로 실제 샘플을 만듭니다.", icon: Scissors },
  { title: "완성품 공개", body: "완성된 옷을 전달하고, 제작 과정과 결과물을 BRAND-ER LAB 콘텐츠로 소개합니다.", icon: Sparkles },
];

// ---------------------------------------------------------------------------
// 브랜더랩 진행 과정 (STREET INTERVIEW × AI DESIGN × REAL PRODUCTION)
// ---------------------------------------------------------------------------

/**
 * BRAND-ER LAB 공식 인스타그램 주소. 확정되면 "https://www.instagram.com/아이디/" 형태로 넣는다.
 * 비워 두면 릴스 안내 섹션의 인스타그램 버튼이 '공식 계정 준비 중'으로 보인다.
 */
export const LAB_INSTAGRAM_URL = "https://www.instagram.com/brander.lab/";

/**
 * 카드 미리보기 이미지 · 영상. 파일을 public/lab/reels/ 에 넣고 경로를 적으면 플레이스홀더 대신 보인다.
 * - image: { type: "image", src: "/lab/reels/interview.webp", alt: "..." }
 * - video: { type: "video", src: "/lab/reels/interview.mp4", poster: "/lab/reels/interview.webp", alt: "..." }
 *   (소리 없이 반복 재생, '동작 줄이기' 설정 사용자에게는 정지 화면(poster)만 보인다. 10초 이내 · 3MB 이하 권장)
 */
export type LabReelsMedia =
  | { type: "image"; src: string; alt: string }
  | { type: "video"; src: string; poster?: string; alt: string };

export type LabReelsStep = {
  key: string;
  /** 영문 단계명 (카드 상단) */
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** 비워 두면 교체 가능한 플레이스홀더 */
  media?: LabReelsMedia;
};

export const LAB_REELS_STEPS: LabReelsStep[] = [
  {
    key: "interview",
    label: "STREET INTERVIEW",
    title: "길거리 인터뷰",
    body: "브랜더랩 촬영팀이 길거리에서 직접 섭외한 분께 평소 입고 싶었던 옷, 나만의 디자인 아이디어를 인터뷰합니다.",
    icon: Mic,
    media: { type: "image", src: "/lab/reels/step-01-interview.svg", alt: "길거리에서 브랜더랩 마이크를 든 촬영팀이 참여자에게 입고 싶은 옷을 인터뷰하는 일러스트" },
  },
  {
    key: "ai-design",
    label: "AI DESIGN",
    title: "AI 의류 디자인",
    body: "인터뷰에서 나온 아이디어와 키워드를 바탕으로 AI를 활용해 세상에 하나뿐인 의류 디자인을 시각화합니다.",
    icon: Wand2,
    media: { type: "image", src: "/lab/reels/step-02-ai-design.svg", alt: "태블릿 화면에서 인터뷰 키워드로 AI가 버건디 후드티 디자인을 시각화하는 일러스트" },
  },
  {
    key: "production",
    label: "REAL PRODUCTION",
    title: "실제 의류 제작",
    body: "완성된 디자인으로 원단 선정, 프린팅, 봉제까지 브랜더의 실제 의류 제작 공정을 거쳐 샘플을 만듭니다.",
    icon: Scissors,
    media: { type: "image", src: "/lab/reels/step-03-production.svg", alt: "작업대 위 원단 롤, 프린팅된 패턴 조각, 가위와 실패로 실제 샘플을 만드는 일러스트" },
  },
  {
    key: "reels",
    label: "REELS CONTENT",
    title: "완성품 전달 및 릴스 촬영",
    body: "완성된 옷을 참여자에게 전달하고, 처음 마주하는 반응과 착용 모습을 촬영해 인스타그램 릴스로 공개합니다.",
    icon: Clapperboard,
    media: { type: "image", src: "/lab/reels/step-04-reels.svg", alt: "완성된 후드티를 입은 참여자를 세로형 스마트폰 영상으로 촬영하고 선물 상자로 전달하는 일러스트" },
  },
];

/** 릴스 촬영 안내 사항 */
export const LAB_REELS_NOTICES: string[] = [
  "길거리 인터뷰 및 의류 제작 과정 촬영",
  "완성품 전달 및 착용 장면 촬영",
  "인스타그램 릴스 콘텐츠 제작",
  "참여자의 촬영 및 게시 동의 확인",
  "실제 프로젝트 선정 및 제작 가능 여부는 별도 안내",
];
