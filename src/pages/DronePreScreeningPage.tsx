import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Scan, ShieldAlert } from 'lucide-react';
import type { PageId } from '../types';
import { DroneScanAnimation } from '../components/animation/DroneScanAnimation';
import { GanodermaMapboxFlow } from '../components/maps/GanodermaMapboxFlow';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type DronePreScreeningPageProps = {
  onNavigate: (page: PageId) => void;
  onFlowReady: () => void;
};

export function DronePreScreeningPage({ onNavigate, onFlowReady }: DronePreScreeningPageProps) {
  const [scanComplete, setScanComplete] = useState(false);
  const completeScan = useCallback(() => {
    setScanComplete(true);
    onFlowReady();
  }, [onFlowReady]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Badge tone="green">Ahmad starts drone / field pre-screening</Badge>
          <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
            Johor Estate A — Drone / Field Pre-Screening
          </h1>
          <p className="mt-3 max-w-4xl text-lg font-medium leading-relaxed text-sentinel-muted">
            500 ha drone / field pre-screened. 2 GPS anomaly zones flagged for TLS confirmation.
          </p>
        </div>
        {scanComplete ? (
          <Button type="button" onClick={() => onNavigate('tls')}>
            Run Targeted TLS Scan
          </Button>
        ) : null}
      </div>

      <Card className="p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black text-sentinel-text">GPS anomaly zone detected in Block 7</h2>
            <p className="mt-1 text-base font-semibold text-sentinel-muted">
              Dr. Palm adds a +2-row buffer around the flagged GPS zone before targeted TLS confirmation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">No visible severe canopy anomaly</Badge>
            <Badge tone="red">TLS confirmation required</Badge>
          </div>
        </div>
        <div className="relative">
          <GanodermaMapboxFlow
            mode="drone"
            scanComplete={scanComplete}
            onRunTls={() => onNavigate('tls')}
          />
          <DroneScanAnimation scanComplete={scanComplete} onComplete={completeScan} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-white">
          <ShieldAlert className="h-7 w-7 text-sentinel-primary" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Pre-screening result</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Blocks 7 and 9 contain GPS anomaly zones requiring targeted TLS confirmation.
          </p>
        </Card>
        <Card className="bg-white">
          <AlertTriangle className="h-7 w-7 text-sentinel-severe" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Next focus</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Ahmad selects Block 7 for targeted TLS confirmation of the flagged GPS zone + 2-row buffer.
          </p>
        </Card>
        <Card className="bg-white">
          <Scan className="h-7 w-7 text-sentinel-primary" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Technical boundary</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Drone / field pre-screening does not classify BSR stages. TLS-derived canopy data from the targeted zone
            + buffer is sent to the UM IP model later in the workflow.
          </p>
        </Card>
      </div>
    </motion.section>
  );
}
