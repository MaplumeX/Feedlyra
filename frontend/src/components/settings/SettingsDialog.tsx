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
          {/* Desktop vertical tab list */}
          <TabsList
            className="hidden h-auto w-40 flex-col justify-start gap-1 sm:flex"
          >
            <TabsTrigger value="general" className="justify-start">{t("general")}</TabsTrigger>
            <TabsTrigger value="ai" className="justify-start">{t("aiSettings")}</TabsTrigger>
            <TabsTrigger value="subscriptions" className="justify-start">{t("subscriptions")}</TabsTrigger>
            <TabsTrigger value="automation" className="justify-start">{t("automation.tabLabel")}</TabsTrigger>
            <TabsTrigger value="about" className="justify-start">{t("about.tabLabel")}</TabsTrigger>
          </TabsList>
          {/* Mobile horizontal tab list */}
          <TabsList className="flex w-full sm:hidden">
            <TabsTrigger value="general" className="flex-1">{t("general")}</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">{t("aiSettings")}</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1">{t("subscriptions")}</TabsTrigger>
            <TabsTrigger value="automation" className="flex-1">{t("automation.tabLabel")}</TabsTrigger>
            <TabsTrigger value="about" className="flex-1">{t("about.tabLabel")}</TabsTrigger>
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
