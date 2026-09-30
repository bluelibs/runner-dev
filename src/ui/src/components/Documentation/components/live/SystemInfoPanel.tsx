import React, { useEffect, useState } from "react";
import { graphqlRequest } from "../../utils/graphqlClient";
import "./SystemInfoPanel.scss";

interface SystemInfo {
  platform: string;
  architecture: string;
  cpuModel: string;
  logicalCores: number;
  totalMemory: number;
  nodeVersion: string;
}

const SYSTEM_INFO_QUERY = `query SystemInfo {
  live {
    systemInfo { platform architecture cpuModel logicalCores totalMemory nodeVersion }
  }
}`;

function formatMemory(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function SystemInfoPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    graphqlRequest<{ live: { systemInfo: SystemInfo } }>(SYSTEM_INFO_QUERY)
      .then(({ live }) => {
        if (mounted) setInfo(live.systemInfo);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="system-info" aria-label="Host system information">
      <div className="system-info__heading">
        <div>
          <span className="system-info__eyebrow">Runtime environment</span>
          <h3>Host system</h3>
        </div>
        <span className="system-info__scope">Server machine</span>
      </div>
      {info ? (
        <div className="system-info__grid">
          <div className="system-info__item system-info__item--cpu">
            <span className="system-info__label">Processor</span>
            <strong title={info.cpuModel}>{info.cpuModel}</strong>
            <span className="system-info__detail">
              {info.logicalCores} logical cores
            </span>
          </div>
          <div className="system-info__item">
            <span className="system-info__label">Installed RAM</span>
            <strong>{formatMemory(info.totalMemory)}</strong>
            <span className="system-info__detail">Host total</span>
          </div>
          <div className="system-info__item">
            <span className="system-info__label">Platform</span>
            <strong>{info.platform}</strong>
            <span className="system-info__detail">{info.architecture}</span>
          </div>
          <div className="system-info__item">
            <span className="system-info__label">Node.js</span>
            <strong>{info.nodeVersion}</strong>
            <span className="system-info__detail">Runtime version</span>
          </div>
        </div>
      ) : (
        <p className="system-info__status" role={error ? "status" : undefined}>
          {error ? "Host details unavailable" : "Loading host details…"}
        </p>
      )}
    </section>
  );
}
