import React from "react";
import { LiveMissionProvider } from "../mission/LiveMissionContext";
import { useMissionControlModel } from "../mission/useMissionControlModel";
import MissionShell from "../components/mission/MissionShell";

const MissionControl = React.memo(function MissionControl() {
  const { liveTools, canvas, shell } = useMissionControlModel();

  return (
    <LiveMissionProvider value={liveTools}>
      <MissionShell
        brand={shell.brand}
        step={shell.step}
        mode={shell.mode}
        onStepChange={shell.onStepChange}
        onModeChange={shell.onModeChange}
        onEnterLive={shell.onEnterLive}
        liveToolsOpen={shell.liveToolsOpen}
        canvas={canvas}
        status={shell.status}
      />
    </LiveMissionProvider>
  );
});

export default MissionControl;
