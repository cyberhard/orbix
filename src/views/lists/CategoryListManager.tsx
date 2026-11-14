// Centralized Domain & Category List Manager
import React, { useState } from "react";
import { usePolicyStore } from "@/store/policy-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  Globe,
  Video,
  Building2,
  MessageSquare,
  Sparkles,
  Gamepad2,
  ShieldAlert,
  Download,
  Upload,
} from "lucide-react";
import { DomainCategory } from "@/services/policy-engine/types";

export const CategoryListManager: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const { categories, addCategory, updateCategory, deleteCategory } = usePolicyStore();

  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<DomainCategory | null>(categories[0] || null);
  const [newDomainInput, setNewDomainInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case "russia": return <Building2 className="h-4 w-4 text-zinc-300" />;
      case "youtube": return <Video className="h-4 w-4 text-zinc-300" />;
      case "discord": return <MessageSquare className="h-4 w-4 text-zinc-300" />;
      case "ai_services": return <Sparkles className="h-4 w-4 text-zinc-300" />;
      case "restricted": return <Globe className="h-4 w-4 text-zinc-300" />;
      case "banking": return <ShieldAlert className="h-4 w-4 text-zinc-300" />;
      case "gaming": return <Gamepad2 className="h-4 w-4 text-zinc-300" />;
      default: return <Layers className="h-4 w-4 text-zinc-400" />;
    }
  };

  const handleAddDomainToCategory = () => {
    if (!selectedCat || !newDomainInput.trim()) return;
    const d = newDomainInput.trim().toLowerCase();

    if (selectedCat.domains.includes(d)) {
      showToast(isRu ? "Домен уже есть в списке" : "Domain already exists in list");
      return;
    }

    const updatedDomains = [...selectedCat.domains, d];
    updateCategory(selectedCat.id, {
      domains: updatedDomains,
      itemCount: updatedDomains.length,
    });
    setSelectedCat({ ...selectedCat, domains: updatedDomains, itemCount: updatedDomains.length });
    setNewDomainInput("");
    showToast(isRu ? `Домен ${d} добавлен!` : `Domain ${d} added!`);
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    if (!selectedCat) return;
    const updatedDomains = selectedCat.domains.filter((d) => d !== domainToRemove);
    updateCategory(selectedCat.id, {
      domains: updatedDomains,
      itemCount: updatedDomains.length,
    });
    setSelectedCat({ ...selectedCat, domains: updatedDomains, itemCount: updatedDomains.length });
    showToast(isRu ? `Домен ${domainToRemove} удален` : `Domain ${domainToRemove} removed`);
  };

  const handleUpdateAllLists = async () => {
    setIsUpdating(true);
    await new Promise((r) => setTimeout(r, 650));
    setIsUpdating(false);
    showToast(isRu ? "Списки доменов успешно синхронизированы!" : "All category domain feeds updated!");
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nameRu.toLowerCase().includes(search.toLowerCase()) ||
      c.descriptionRu.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-zinc-400" />
            <span>{isRu ? "Менеджер списков и категорий доменов" : "Domain & Category List Manager"}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRu
              ? "Централизованные многоразовые списки доменов и IP для использования в политиках маршрутизации"
              : "Centralized domain & CIDR feeds reused across routing policies without duplicate definitions"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleUpdateAllLists}
            disabled={isUpdating}
            className="text-xs h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            {isRu ? "Обновить фиды" : "Update Feeds"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Two-column layout: Categories on Left, Domains Editor on Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Categories List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRu ? "Поиск категории..." : "Filter categories..."}
              className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredCategories.map((cat) => {
              const isSelected = selectedCat?.id === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCat(cat)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? "border-zinc-700 bg-zinc-900 text-zinc-100 shadow-sm"
                      : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(cat.id)}
                      <span className="font-semibold text-xs text-zinc-100">
                        {isRu ? cat.nameRu : cat.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] bg-zinc-950 border-zinc-800 text-zinc-400">
                      {cat.domains.length} {isRu ? "доменов" : "domains"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">
                    {isRu ? cat.descriptionRu : cat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Category Domain Editor */}
        <div className="lg:col-span-7 space-y-4">
          {selectedCat ? (
            <Card className="border-zinc-800 bg-zinc-950 shadow-md">
              <CardHeader className="pb-3 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(selectedCat.id)}
                    <div>
                      <CardTitle className="text-xs font-semibold text-zinc-100">
                        {isRu ? selectedCat.nameRu : selectedCat.name}
                      </CardTitle>
                      <CardDescription className="text-[11px] text-zinc-400">
                        ID: category:{selectedCat.id} • {selectedCat.domains.length} {isRu ? "записей" : "entries"}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Add domain input */}
                <div className="flex gap-2">
                  <Input
                    value={newDomainInput}
                    onChange={(e) => setNewDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddDomainToCategory()}
                    placeholder={isRu ? "Добавить домен (например, example.com или .org)..." : "Add domain (e.g. example.com)..."}
                    className="h-8 text-xs font-mono bg-zinc-900 border-zinc-800 text-zinc-100"
                  />
                  <Button
                    onClick={handleAddDomainToCategory}
                    size="sm"
                    className="h-8 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isRu ? "Добавить" : "Add"}
                  </Button>
                </div>

                {/* Domains Pill Grid */}
                <div className="max-h-96 overflow-y-auto space-y-1.5 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
                  {selectedCat.domains.map((dom) => (
                    <div
                      key={dom}
                      className="flex items-center justify-between px-3 py-1.5 rounded-md bg-zinc-950 border border-zinc-800/70 text-xs font-mono text-zinc-200 group hover:border-zinc-700"
                    >
                      <span className="text-emerald-400">{dom}</span>
                      <button
                        onClick={() => handleRemoveDomain(dom)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        title={isRu ? "Удалить домен" : "Delete domain"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              {isRu ? "Выберите категорию слева для просмотра доменов" : "Select a category on the left"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
