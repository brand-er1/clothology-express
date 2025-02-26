
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface SystemPromptEditorProps {
  systemPrompt: string;
  isLoading: boolean;
  onSave: (prompt: string) => Promise<void>;
}

export const SystemPromptEditor = ({
  systemPrompt: initialPrompt,
  isLoading,
  onSave,
}: SystemPromptEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(systemPrompt);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">이미지 생성 시스템 프롬프트</h2>
      <div className="space-y-4">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : (
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={!isEditing}
            className="min-h-[300px] font-mono text-sm"
          />
        )}
        
        <div className="flex justify-end gap-4">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} disabled={isLoading}>
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
  );
};
