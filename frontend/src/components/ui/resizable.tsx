import * as React from "react";
import { GripVertical } from "lucide-react";
import { Group, Panel, Separator as PanelSeparator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type GroupProps = React.ComponentProps<typeof Group>;

const ResizablePanelGroup = ({
  className,
  orientation = "horizontal",
  ...props
}: GroupProps & { orientation?: "horizontal" | "vertical" }) => (
  <Group
    className={cn(
      "flex h-full w-full",
      orientation === "vertical" && "flex-col",
      className
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

type SeparatorProps = React.ComponentProps<typeof PanelSeparator>;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean;
}) => (
  <PanelSeparator
    className={cn(
      "relative flex w-px items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full [&[data-resize-handle-state=drag]]:bg-primary/20 [&[data-resize-handle-state=hover]]:bg-primary/10",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </PanelSeparator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
