import MyBrand from "@/pages/MyBrand";
import { PageHeader } from "@/components/admin/shell/ui";
import { useSellerContext } from "./sellerContext";

/** 브랜드 설정: 기존 제작자 프로필 · 브랜드(brands, creator_profiles)를 그대로 편집한다. 별도 판매자 계정은 없다. */
const BrandPage = () => {
  const { reloadBrand } = useSellerContext();
  return (
    <div>
      <PageHeader eyebrow="Brand" title="브랜드 설정" description="제작자 프로필과 브랜드 정보는 펀딩 카드 · 상품 상세 · 브랜드 페이지에 공개됩니다." />
      <MyBrand embedded onSaved={reloadBrand} />
    </div>
  );
};

export default BrandPage;
