
import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SizeData {
  [key: string]: number;
}

const DEFAULT_TOP_SIZES: SizeData = {
  totalLength: 0,
  shoulderWidth: 0,
  chestCircumference: 0,
  bottomCircumference: 0,
  sleeveLength: 0,
};

const DEFAULT_BOTTOM_SIZES: SizeData = {
  totalLength: 0,
  waistCircumference: 0,
  hipCircumference: 0,
  thighCircumference: 0,
};

const Customize = () => {
  const [topSizes, setTopSizes] = useState<SizeData>(DEFAULT_TOP_SIZES);
  const [bottomSizes, setBottomSizes] = useState<SizeData>(DEFAULT_BOTTOM_SIZES);
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (category: 'top' | 'bottom', field: string, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    if (category === 'top') {
      setTopSizes(prev => ({ ...prev, [field]: numValue }));
    } else {
      setBottomSizes(prev => ({ ...prev, [field]: numValue }));
    }
  };

  const handleSave = () => {
    // TODO: 실제 저장 로직 구현
    toast({
      title: "저장 완료",
      description: "사이즈가 저장되었습니다.",
    });
    setIsEditing(false);
  };

  const TOP_SIZE_LABELS = {
    totalLength: "총장",
    shoulderWidth: "어깨넓이",
    chestCircumference: "가슴 둘레",
    bottomCircumference: "밑단 둘레",
    sleeveLength: "소매 길이",
  };

  const BOTTOM_SIZE_LABELS = {
    totalLength: "총장",
    waistCircumference: "허리 둘레",
    hipCircumference: "엉덩이 단면",
    thighCircumference: "허벅지 단면",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold">맞춤 사이즈 설정</h1>

          <Card>
            <CardHeader>
              <CardTitle>상의 사이즈</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>항목</TableHead>
                    <TableHead>치수 (cm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(TOP_SIZE_LABELS).map(([key, label]) => (
                    <TableRow key={key}>
                      <TableCell>{label}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={topSizes[key] || ''}
                          onChange={(e) => handleChange('top', key, e.target.value)}
                          disabled={!isEditing}
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>하의 사이즈</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>항목</TableHead>
                    <TableHead>치수 (cm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(BOTTOM_SIZE_LABELS).map(([key, label]) => (
                    <TableRow key={key}>
                      <TableCell>{label}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={bottomSizes[key] || ''}
                          onChange={(e) => handleChange('bottom', key, e.target.value)}
                          disabled={!isEditing}
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                수정하기
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  취소
                </Button>
                <Button onClick={handleSave}>
                  저장하기
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
