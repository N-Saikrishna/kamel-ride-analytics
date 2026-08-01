// Dashboard header — title, range presets, Live polling toggle.

import type { ReactNode } from "react";
import type { DateRangeKey } from "../api.js";

const RANGES: DateRangeKey[] = ["24h", "7d", "30d"];

export function Header(props: {
  rangeKey: DateRangeKey;
  live: boolean;
  onRangeChange: (key: DateRangeKey) => void;
  onLiveChange: (live: boolean) => void;
}): ReactNode {
  return (
    <header className="header">
      <h1>Kamel Ride Analytics</h1>
      <div className="header-controls">
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={props.rangeKey === key}
              onClick={() => {
                props.onRangeChange(key);
              }}
            >
              {key}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="live-toggle"
          data-on={props.live ? "true" : "false"}
          aria-pressed={props.live}
          onClick={() => {
            props.onLiveChange(!props.live);
          }}
        >
          <span className="live-dot" aria-hidden="true" />
          Live
        </button>
      </div>
    </header>
  );
}
