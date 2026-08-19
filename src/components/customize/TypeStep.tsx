import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clothTypes } from "@/lib/customize-constants";
import { Check } from "lucide-react";

interface TypeStepProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

export const TypeStep = ({ selectedType, onSelectType }: TypeStepProps) => {
  const renderTypes = (category: "tops" | "bottoms") => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clothTypes
        .filter((type) => type.category === category)
        .map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <Card
              key={type.id}
              role="button"
              tabIndex={0}
              className={`group relative cursor-pointer rounded-2xl p-4 transition-all duration-200 sm:p-6 ${
                isSelected
                  ? "border-brand bg-[#fff9f7] shadow-[0_12px_35px_rgba(113,16,17,0.08)] ring-1 ring-brand"
                  : "border-stone-200 bg-white hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-lg"
              }`}
              onClick={() => onSelectType(type.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectType(type.id);
              }}
            >
              {isSelected && (
                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3ede8] text-brand transition group-hover:bg-brand group-hover:text-white sm:h-14 sm:w-14 sm:rounded-2xl">
                {type.icon}
              </div>
              <h3 className="mt-4 text-[17px] font-bold sm:mt-5 sm:text-lg">{type.name}</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-stone-500 sm:mt-2 sm:text-sm">{type.description}</p>
            </Card>
          );
        })}
    </div>
  );

  return (
    <Tabs defaultValue="tops" className="w-full" data-tutorial="customize-type">
      <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-full bg-[#eee9e3] p-1 sm:mb-6 sm:w-64">
        <TabsTrigger value="tops" className="rounded-full font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">상의</TabsTrigger>
        <TabsTrigger value="bottoms" className="rounded-full font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">하의</TabsTrigger>
      </TabsList>
      <TabsContent value="tops" className="mt-0">{renderTypes("tops")}</TabsContent>
      <TabsContent value="bottoms" className="mt-0">{renderTypes("bottoms")}</TabsContent>
    </Tabs>
  );
};
