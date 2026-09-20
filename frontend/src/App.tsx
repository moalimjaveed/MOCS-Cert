import React, { useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';
import { SettingsModal } from './components/layout/SettingsModal';
import { CertificateAuditorModal } from './components/proof/CertificateAuditorModal';
import { DocumentationModal } from './components/docs/DocumentationModal';
import { WorkstationView } from './components/views/WorkstationView';
import { ExplorationView } from './components/views/ExplorationView';
import { AppBootLoader } from './components/loading/AppBootLoader';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useUIStore, useScanStore, useTimelineStore } from './store';
import { fetchTrajectoryMetadata, fetchBlocks } from './api/client';
import { wsService } from './api/websocket';
import { initMocsRouter } from './navigation/router';

export function App() {
  const activeView = useUIStore((s) => s.activeView);
  const setMetadata = useScanStore((s) => s.setMetadata);
  const setBlocks = useTimelineStore((s) => s.setBlocks);
  const selectBlock = useTimelineStore((s) => s.selectBlock);

  // Initialize canonical routing and URL synchronization on mount
  useEffect(() => {
    const unbind = initMocsRouter();
    return unbind;
  }, []);

  useEffect(() => {
    // 1. Establish WebSocket connection
    wsService.connect();

    // 2. Fetch initial metadata with honest status tracking
    setMetadata({ metadataStatus: 'loading' });
    fetchTrajectoryMetadata()
      .then((meta) => {
        setMetadata({
          trajectoryId: meta.trajectory_id,
          topologyId: meta.topology_id,
          totalFrames: meta.total_frames,
          timeSpanNs: meta.time_span_ns,
          timestepPs: meta.timestep_ps,
          atomCount: meta.atom_count,
          pbcMode: meta.pbc_mode,
          samplingSemantics: meta.sampling_semantics,
          mciStatus: meta.mci_status,
          arrayBackend: meta.array_backend,
          activeAccelerator: meta.active_accelerator,
          metadataStatus: 'ready',
        });
      })
      .catch((e) => {
        console.warn('Backend offline or connecting...', e);
        setMetadata({ metadataStatus: 'error', mciStatus: 'OFFLINE' });
      });

    // 3. Fetch initial block lattice
    fetchBlocks()
      .then((blocks) => {
        setBlocks(blocks);
        if (blocks && blocks.length > 0) {
          const currentSelected = useTimelineStore.getState().selectedBlockId;
          if (currentSelected === null || currentSelected === undefined) {
            selectBlock(blocks[0].block_id);
          }
        }
      })
      .catch((e) => console.warn('Blocks offline or connecting...', e));

    return () => {
      wsService.disconnect();
    };
  }, [setMetadata, setBlocks, selectBlock]);

  return (
    <div className="flex flex-col w-screen h-screen h-dvh max-h-screen overflow-hidden bg-[#F3F3F3] text-[#1C1C1C] font-sans antialiased">
      {/* Precision Boot Loader Sequence */}
      <AppBootLoader />

      {/* Top Application Status Bar */}
      <TopBar />

      {/* Main Scientific Viewport Area */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col md:flex-row">
        <ErrorBoundary fallbackTitle="Scientific Viewport Runtime Error">
          {activeView === 'workstation' ? <WorkstationView /> : <ExplorationView />}
        </ErrorBoundary>
      </main>

      {/* Modals and Overlays */}
      <CertificateAuditorModal />
      <DocumentationModal />
      <CommandPalette />
      <SettingsModal />
    </div>
  );
}

export default App;
