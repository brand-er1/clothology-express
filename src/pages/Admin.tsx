
import { useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

const Admin = () => {
  const [systemPrompt, setSystemPrompt] = useState(
    `Assist in generating precise and optimized prompts for the FLUX AI model to create high-quality fashion image based on user input.

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
6. Output must be in English, and only return result.`
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase.functions.invoke('update-system-prompt', {
        body: { systemPrompt }
      });

      if (error) throw error;

      toast({
        title: "저장 완료",
        description: "시스템 프롬프트가 업데이트되었습니다.",
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving system prompt:', error);
      toast({
        title: "오류",
        description: "시스템 프롬프트 저장에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                disabled={!isEditing}
                className="min-h-[300px] font-mono text-sm"
              />
              
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
                      disabled={isSaving}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "저장 중..." : "저장하기"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
