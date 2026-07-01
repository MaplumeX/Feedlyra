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
      <DialogContent className={`transition-[max-width] duration-150 max-h-[calc(100vh-4rem)] overflow-y-auto ${activeTab === "subscriptions" ? "sm:max-w-2xl" : activeTab === "automation" ? "sm:max-w-xl" : "sm:max-w-[480px]"}`}>
        <DialogHeader>
          <DialogTitle>{t("settings")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-2"
        >
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">{t("general")}</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">{t("aiSettings")}</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1">{t("subscriptions")}</TabsTrigger>
            <TabsTrigger value="automation" className="flex-1">{t("automation.tabLabel")}</TabsTrigger>
            <TabsTrigger value="about" className="flex-1">{t("about.tabLabel")}</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4">
            <GeneralSettingsTab />
          </TabsContent>
          <TabsContent value="ai" className="mt-4">
            <AISettingsTab />
          </TabsContent>
          <TabsContent value="subscriptions" className="mt-4">
            <SubscriptionsTab />
          </TabsContent>
          <TabsContent value="automation" className="mt-4">
            <AutomationTab />
          </TabsContent>
          <TabsContent value="about" className="mt-4">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
