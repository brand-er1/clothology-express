
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const Admin = () => {
  const [systemPrompt, setSystemPrompt] = useState("");
  
  useEffect(() => {
    const fetchSystemPrompt = async () => {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('content')
        .single();
      
      if (error) {
        console.error('Error fetching system prompt:', error);
        toast({
          title: "에러",
          description: "시스템 프롬프트를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setSystemPrompt(data.content);
      }
    };

    fetchSystemPrompt();
  }, []);

  const handleSavePrompt = async () => {
    const { error } = await supabase
      .from('system_prompts')
      .upsert({ id: 1, content: systemPrompt });

    if (error) {
      console.error('Error saving system prompt:', error);
      toast({
        title: "에러",
        description: "시스템 프롬프트 저장에 실패했습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "성공",
      description: "시스템 프롬프트가 저장되었습니다.",
    });
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
                placeholder="이미지 생성을 위한 시스템 프롬프트를 입력하세요..."
                className="min-h-[200px]"
              />
              <Button onClick={handleSavePrompt} className="w-full">
                저장
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
