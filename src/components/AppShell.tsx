"use client";

import DetailsSlot from "./DetailsSlot";
import Sidebar from "./Sidebar";
import PlayerBar from "./PlayerBar";
import ProfileDialog from "./ProfileDialog";
import QueuePanel from "./QueuePanel";
import PersonaDialog from "./voice/PersonaDialog";
import { AddInstrumentalDialog, CoverDialog, DownloadDialog, ExtendDialog, ReplaceDialog } from "./Dialogs";
import { StudioProvider, useStudio } from "./StudioContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StudioProvider>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="flex min-w-0 flex-1">{children}</main>
          {/* Song details open from the player on any page, so the drawer lives in the shell. */}
          <DetailsSlot />
        </div>
        <PlayerBar />
      </div>
      <Overlays />
    </StudioProvider>
  );
}

function Overlays() {
  const { dialog, closeDialog, load, toast, profileOpen } = useStudio();
  return (
    <>
      {dialog?.type === "extend" && <ExtendDialog song={dialog.song} onClose={closeDialog} onStarted={load} />}
      {dialog?.type === "cover" && <CoverDialog song={dialog.song} onClose={closeDialog} onStarted={load} />}
      {dialog?.type === "replace" && <ReplaceDialog song={dialog.song} onClose={closeDialog} onStarted={load} />}
      {dialog?.type === "download" && <DownloadDialog song={dialog.song} onClose={closeDialog} />}
      {dialog?.type === "addInstrumental" && (
        <AddInstrumentalDialog song={dialog.song} onClose={closeDialog} onStarted={load} />
      )}
      {dialog?.type === "persona" && <PersonaDialog song={dialog.song} onClose={closeDialog} />}
      {profileOpen && <ProfileDialog />}
      <QueuePanel />
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
