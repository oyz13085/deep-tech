import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Radar } from 'lucide-react';

type DroneScanAnimationProps = {
  scanComplete: boolean;
  onComplete: () => void;
};

const statuses = [
  'Initialising drone pre-screening...',
  'Scanning estate canopy patterns...',
  'Detecting GPS anomaly zones...',
  '2 GPS anomaly zones flagged for TLS confirmation',
];

export function DroneScanAnimation({ scanComplete, onComplete }: DroneScanAnimationProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (scanComplete) {
      setStatusIndex(statuses.length - 1);
      return;
    }

    const statusTimer = window.setInterval(() => {
      setStatusIndex((current) => Math.min(current + 1, statuses.length - 1));
    }, 1700);

    const completeTimer = window.setTimeout(() => {
      setStatusIndex(statuses.length - 1);
      onComplete();
    }, 5600);

    return () => {
      window.clearInterval(statusTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete, scanComplete]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
      {!scanComplete ? (
        <>
          <motion.div
            className="absolute bottom-0 top-0 w-28 bg-gradient-to-r from-transparent via-white/45 to-transparent"
            initial={{ x: '-20%' }}
            animate={{ x: ['-20%', '110%'] }}
            transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              d="M10 14 H86 V28 H14 V42 H86 V56 H14 V70 H86"
              fill="none"
              stroke="rgba(15,61,46,0.22)"
              strokeWidth="0.45"
              strokeDasharray="2 2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 5.2, ease: 'easeInOut' }}
            />
          </svg>
          <motion.div
            className="absolute left-[7%] top-[8%]"
            animate={{
              x: ['0vw', '58vw', '58vw', '2vw', '2vw', '58vw'],
              y: ['0rem', '0rem', '8.8rem', '8.8rem', '17.6rem', '17.6rem'],
            }}
            transition={{ duration: 5.6, ease: 'easeInOut' }}
          >
            <div className="relative">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-white/80 bg-sentinel-deep text-white shadow-panel">
                <Plane className="h-8 w-8 rotate-45" />
              </div>
              <motion.div
                className="absolute left-1/2 top-14 h-28 w-24 -translate-x-1/2 bg-gradient-to-b from-[#2D6A4F]/28 to-transparent"
                style={{ clipPath: 'polygon(45% 0%, 55% 0%, 100% 100%, 0% 100%)' }}
                animate={{ opacity: [0.35, 0.72, 0.35] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </>
      ) : null}
      <div className="absolute bottom-36 left-5 z-30 w-[min(38rem,calc(100%-2.5rem))] rounded-[14px] border border-white/20 bg-[rgba(8,20,14,0.94)] px-4 py-3 text-white shadow-2xl backdrop-blur-md md:w-[48%] md:max-w-[640px]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#7EE2A8]/16 text-[#7EE2A8]">
            <Radar className="h-5 w-5" />
          </div>
          <motion.div
            key={statusIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-base font-black leading-snug text-white md:text-lg">
              {scanComplete ? 'Block 7 GPS anomaly zone flagged for TLS confirmation' : statuses[statusIndex]}
            </div>
            <div className="mt-1 text-sm font-semibold leading-snug text-[#DDE8DF] md:text-base">
              {scanComplete
                ? 'Dr. Palm adds a +2-row buffer before targeted TLS confirmation.'
                : 'Drone / field pre-screening is scanning estate canopy patterns.'}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
