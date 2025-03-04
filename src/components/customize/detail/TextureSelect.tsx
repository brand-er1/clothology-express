
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextureOption } from "@/lib/customize-constants";

interface TextureSelectProps {
  selectedTexture: string;
  textureOptions: TextureOption[];
  onTextureSelect: (value: string) => void;
}

export const TextureSelect = ({ selectedTexture, textureOptions, onTextureSelect }: TextureSelectProps) => {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">촉감</h3>
      <Select value={selectedTexture} onValueChange={onTextureSelect}>
        <SelectTrigger>
          <SelectValue placeholder="촉감 선택" />
        </SelectTrigger>
        <SelectContent>
          {textureOptions.map((texture) => (
            <SelectItem key={texture.value} value={texture.value}>
              {texture.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
};
