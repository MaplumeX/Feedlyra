import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useImportOPML, useExportOPML } from "@/api/hooks";

export function SubscriptionsTab() {
  const { t } = useTranslation("settings");
  const importOPML = useImportOPML();
  const exportOPML = useExportOPML();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleExport = async () => {
    try {
      const result = await exportOPML.mutateAsync();
      const blob = new Blob([result.xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "feeds.opml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("opmlExportSuccess"));
    } catch {
      toast.error(t("opmlExportFailed"));
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith(".opml") && !file.name.endsWith(".xml")) {
      toast.error(t("opmlInvalidFile"));
      return;
    }
    try {
      const feeds = await importOPML.mutateAsync(file);
      toast.success(t("opmlImportSuccess", { count: feeds.length }));
    } catch {
      toast.error(t("opmlImportFailed"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t("opmlExport")}</Label>
        <p className="text-sm text-muted-foreground">{t("opmlExportDescription")}</p>
        <Button onClick={handleExport} disabled={exportOPML.isPending}>
          {exportOPML.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {t("opmlExportButton")}
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>{t("opmlImport")}</Label>
        <p className="text-sm text-muted-foreground">{t("opmlImportDescription")}</p>
        <div
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {importOPML.isPending ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {importOPML.isPending ? t("opmlImporting") : t("opmlDropOrClick")}
          </p>
          <input ref={fileInputRef} type="file" accept=".opml,.xml" className="hidden" onChange={handleFileChange} />
        </div>
      </div>
    </div>
  );
}
