import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReaderStore } from "@/stores/reader";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { AISettingsTab } from "./AISettingsTab";
import { SubscriptionsTab } from "./SubscriptionsTab";
import { AutomationTab } from "./AutomationTab";
import { AboutTab } from "./AboutTab";

export function SettingsDialog() {
  const { t } = useTranslation("settings");
  const { settingsDialogOpen, settingsDialogTab, set: setReader } = useReaderStore();
  const [activeTab, setActiveTab] = useState(settingsDialogTab ?? "general");

  useEffect(() => {
    if (settingsDialogTab) {
      setActiveTab(settingsDialogTab);
    }
  }, [settingsDialogTab]);

  return (
    <Dialog
      open={settingsDialogOpen}
      onOpenChange={(open) => setReader({ settingsDialogOpen: open, settingsDialogTab: undefined })}
    >
      <DialogContent className="sm:max-w-3xl h-[80vh] max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("settings")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4 flex-1 min-h-0"
        >
          {/* Desktop vertical tab list — minimal text style */}
          <TabsList
            className="hidden h-auto w-48 flex-col justify-start gap-0.5 bg-transparent p-0 sm:flex"
          >
            <TabsTrigger
              value="general"
              className="relative w-full justify-start rounded-md px-3 py-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:before:absolute data-[state=active]:before:bottom-1.5 data-[state=active]:before:left-0 data-[state=active]:before:top-1.5 data-[state=active]:before:w-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-primary"
            >
              {t("general")}
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="relative w-full justify-start rounded-md px-3 py-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:before:absolute data-[state=active]:before:bottom-1.5 data-[state=active]:before:left-0 data-[state=active]:before:top-1.5 data-[state=active]:before:w-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-primary"
            >
              {t("aiSettings")}
            </TabsTrigger>
            <TabsTrigger
              value="subscriptions"
              className="relative w-full justify-start rounded-md px-3 py-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:before:absolute data-[state=active]:before:bottom-1.5 data-[state=active]:before:left-0 data-[state=active]:before:top-1.5 data-[state=active]:before:w-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-primary"
            >
              {t("subscriptions")}
            </TabsTrigger>
            <TabsTrigger
              value="automation"
              className="relative w-full justify-start rounded-md px-3 py-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:before:absolute data-[state=active]:before:bottom-1.5 data-[state=active]:before:left-0 data-[state=active]:before:top-1.5 data-[state=active]:before:w-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-primary"
            >
              {t("automation.tabLabel")}
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="relative w-full justify-start rounded-md px-3 py-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:before:absolute data-[state=active]:before:bottom-1.5 data-[state=active]:before:left-0 data-[state=active]:before:top-1.5 data-[state=active]:before:w-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-primary"
            >
              {t("about.tabLabel")}
            </TabsTrigger>
          </TabsList>
          {/* Mobile horizontal tab list — underline style */}
          <TabsList className="flex w-full justify-start gap-0 border-b border-border bg-transparent p-0 sm:hidden">
            <TabsTrigger
              value="general"
              className="flex-1 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t("general")}
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="flex-1 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t("aiSettings")}
            </TabsTrigger>
            <TabsTrigger
              value="subscriptions"
              className="flex-1 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t("subscriptions")}
            </TabsTrigger>
            <TabsTrigger
              value="automation"
              className="flex-1 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t("automation.tabLabel")}
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="flex-1 rounded-none border-b-2 border-transparent px-2 py-2.5 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t("about.tabLabel")}
            </TabsTrigger>
          </TabsList>
          <div className="mt-4 sm:mt-0 sm:ml-6 sm:min-w-0 flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="general" className="mt-0">
              <GeneralSettingsTab />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <AISettingsTab />
            </TabsContent>
            <TabsContent value="subscriptions" className="mt-0">
              <SubscriptionsTab />
            </TabsContent>
            <TabsContent value="automation" className="mt-0">
              <AutomationTab />
            </TabsContent>
            <TabsContent value="about" className="mt-0">
              <AboutTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
