// ORBIX • Section tabs bar (shadcn/ui zinc) used by hub pages (Routing, Diagnostics, Settings...)
import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SectionTabItem {
  value: string;
  label: string;
}

interface SectionTabsProps {
  value: string;
  onChange: (value: string) => void;
  items: SectionTabItem[];
  className?: string;
}

export const SectionTabs: React.FC<SectionTabsProps> = ({ value, onChange, items, className }) => (
  <Tabs value={value} onValueChange={onChange}>
    <TabsList className={cnList(className)}>
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value} data-tab={item.value} className="text-xs">
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

function cnList(className?: string) {
  return ["mb-4", className].filter(Boolean).join(" ");
}
