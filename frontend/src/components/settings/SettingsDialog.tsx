import { useState } from "react";
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

export function SettingsDialog() {
  const { t } = useTranslation("settings");
  const { settingsDialogOpen, set: setReader } = useReaderStore();
  const [activeTab, setActiveTab] = useState("general");

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={(open) => setReader({ settingsDialogOpen: open })}>
      <DialogContent className={`transition-[max-width] duration-200 ${activeTab === "subscriptions" ? "sm:max-w-2xl" : "sm:max-w-[480px]"}`}>
        <DialogHeader>
          <DialogTitle>{t("settings")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">{t("general")}</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">{t("aiSettings")}</TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-1">{t("subscriptions")}</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
