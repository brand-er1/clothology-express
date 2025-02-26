
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const SYSTEM_PROMPT = `Assist in generating precise and optimized prompts for the FLUX AI model to create high-quality fashion image based on user input.

1. Make the prompt detailed with:
- Clothing type (e.g., jacket, dress).
- Colors, patterns, and materials.
- Style or theme (e.g., casual, formal).
- Accessories or design details.
- Target audience (e.g., men's, women's).
2. Use vivid adjectives to guide image generation accurately.
3. Keep the prompt concise but descriptive, and don't omit details in input.
4. If there are not sufficient details, add details based on your knowledge about garment.
5. Add this prompt at the end. : "Showcasing the front view on the left side and the back view on the right side. Show only cloth."
6. Output must be in English, and only return result.`;

const Admin = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">관리자 설정</h1>
          
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">이미지 생성 시스템 프롬프트</h2>
            <div className="space-y-4">
              <Textarea
                value={SYSTEM_PROMPT}
                readOnly
                className="min-h-[200px]"
              />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
