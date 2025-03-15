import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clothTypes } from "@/lib/customize-constants";
import { useIsMobile } from "@/hooks/use-mobile";

interface TypeStepProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

export const TypeStep = ({ selectedType, onSelectType }: TypeStepProps) => {
  const isMobile = useIsMobile();
  
  // 타입 매핑 - Edge Function에 전달될 타입명과 일치하도록
  const getTypeValue = (typeId: string): string => {
    const typeMapping: { [key: string]: string } = {
      'jacket': 'outer_jacket',
      'hoodie': 'hoodie',
      'long_pants': 'long_pants',
      'short_pants': 'short_pants',
      'short_sleeve': 'short_sleeve',
      'long_sleeve': 'long_sleeve',
      'sweatshirt': 'sweatshirt'
    };
    
    return typeMapping[typeId] || typeId;
  };

  // Filter types by category
  const topsTypes = clothTypes.filter(type => type.category === "tops");
  const bottomsTypes = clothTypes.filter(type => type.category === "bottoms");

  // Mobile layout with tabs
  if (isMobile) {
    return (
      <div className="space-y-4">
        <Tabs defaultValue="tops" className="w-full">
          <TabsList className="grid grid-cols-2 w-full h-12">
            <TabsTrigger value="tops" className="text-base py-3">상의</TabsTrigger>
            <TabsTrigger value="bottoms" className="text-base py-3">하의</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tops" className="mt-4">
            <div className="grid grid-cols-1 gap-4">
              {topsTypes.map((type) => (
                <Card
                  key={type.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedType === type.id
                      ? "border-brand ring-2 ring-brand/20"
                      : "hover:border-brand/20"
                  }`}
                  onClick={() => onSelectType(type.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-brand/5 rounded-full flex items-center justify-center">
                      {type.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-base font-semibold">{type.name}</h3>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="bottoms" className="mt-4">
            <div className="grid grid-cols-1 gap-4">
              {bottomsTypes.map((type) => (
                <Card
                  key={type.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedType === type.id
                      ? "border-brand ring-2 ring-brand/20"
                      : "hover:border-brand/20"
                  }`}
                  onClick={() => onSelectType(type.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-brand/5 rounded-full flex items-center justify-center">
                      {type.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-base font-semibold">{type.name}</h3>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="space-y-8">
      {/* Tops Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">상의</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clothTypes
            .filter((type) => type.category === "tops")
            .map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedType === type.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-brand/5 rounded-full flex items-center justify-center">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Bottoms Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">하의</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clothTypes
            .filter((type) => type.category === "bottoms")
            .map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedType === type.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-brand/5 rounded-full flex items-center justify-center">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
};
