"use client";
import { useState } from "react";
import { Users } from "lucide-react";

type GeoItem = {
  title?: unknown;
  description?: unknown;
  level?: unknown;
  value?: unknown;
  unit?: unknown;
};

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

// Accurate India state silhouettes in 220x250 viewBox, dynamically colored by real CMS GEOGRAPHY items.
const INDIA_STATES: ReadonlyArray<{
  id: string;
  name: string;
  aliases: string[];
  d: string;
}> = [
  { id: "JK", name: "Jammu & Kashmir", aliases: ["jammu", "kashmir", "ladakh", "j&k"], d: "M74,8 L92,6 L104,16 L98,30 L88,36 L76,34 L66,24 Z" },
  { id: "HP", name: "Himachal Pradesh", aliases: ["himachal"], d: "M76,34 L88,36 L92,47 L80,50 L73,42 Z" },
  { id: "PB", name: "Punjab", aliases: ["punjab"], d: "M63,36 L76,34 L77,48 L65,52 L59,44 Z" },
  { id: "UK", name: "Uttarakhand", aliases: ["uttarakhand", "uttaranchal"], d: "M88,47 L102,48 L104,58 L90,59 L84,52 Z" },
  { id: "HR", name: "Haryana", aliases: ["haryana", "delhi"], d: "M65,52 L77,48 L80,62 L68,65 L62,58 Z" },
  { id: "RJ", name: "Rajasthan", aliases: ["rajasthan"], d: "M34,62 L62,56 L72,68 L68,88 L46,95 L26,82 Z" },
  { id: "UP", name: "Uttar Pradesh", aliases: ["uttar pradesh", "up"], d: "M78,56 L104,58 L122,74 L114,90 L88,88 L76,74 Z" },
  { id: "BR", name: "Bihar", aliases: ["bihar"], d: "M120,76 L144,76 L146,92 L122,93 Z" },
  { id: "SK", name: "Sikkim", aliases: ["sikkim"], d: "M148,68 L154,68 L154,76 L148,76 Z" },
  { id: "NE", name: "North East", aliases: ["assam", "arunachal", "meghalaya", "manipur", "mizoram", "nagaland", "tripura", "north east"], d: "M154,68 L186,62 L198,74 L184,96 L170,94 L162,82 L154,78 Z" },
  { id: "WB", name: "West Bengal", aliases: ["west bengal", "bengal", "kolkata", "murshidabad"], d: "M144,76 L154,78 L156,96 L146,112 L136,106 L140,92 Z" },
  { id: "JH", name: "Jharkhand", aliases: ["jharkhand"], d: "M122,93 L140,92 L136,108 L118,108 L116,98 Z" },
  { id: "GJ", name: "Gujarat", aliases: ["gujarat"], d: "M18,92 L46,95 L50,114 L38,124 L20,118 L14,104 Z" },
  { id: "MP", name: "Madhya Pradesh", aliases: ["madhya pradesh", "mp"], d: "M50,92 L88,88 L108,94 L102,114 L64,116 L48,108 Z" },
  { id: "CG", name: "Chhattisgarh", aliases: ["chhattisgarh"], d: "M108,94 L118,108 L114,132 L100,130 L98,114 Z" },
  { id: "OD", name: "Odisha", aliases: ["odisha", "orissa"], d: "M118,108 L140,108 L144,122 L122,136 L112,126 Z" },
  { id: "MH", name: "Maharashtra", aliases: ["maharashtra", "mumbai"], d: "M44,118 L94,116 L98,136 L72,154 L46,148 L40,132 Z" },
  { id: "TS", name: "Telangana", aliases: ["telangana"], d: "M82,140 L104,136 L108,154 L86,158 Z" },
  { id: "AP", name: "Andhra Pradesh", aliases: ["andhra", "andhra pradesh"], d: "M86,158 L120,140 L124,154 L100,180 L84,174 Z" },
  { id: "KA", name: "Karnataka", aliases: ["karnataka", "bengaluru", "bangalore"], d: "M52,152 L82,152 L84,182 L64,194 L52,174 Z" },
  { id: "KL", name: "Kerala", aliases: ["kerala"], d: "M58,186 L68,194 L72,222 L62,220 L54,200 Z" },
  { id: "TN", name: "Tamil Nadu", aliases: ["tamil nadu", "chennai"], d: "M68,184 L96,178 L92,208 L74,224 L68,200 Z" },
];

const LEVEL_COLOR: Record<string, string> = {
  HIGH: "#15803D",
  MEDIUM: "#EAB308",
  EXPANDING: "#60A5FA",
};

export function CmsImpactGeoCard({
  heading,
  items,
  sourceNode,
}: {
  heading: string;
  items: GeoItem[];
  sourceNode?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"INDIA" | "STATES" | "DISTRICTS">("INDIA");

  const matchStateLevel = (aliases: string[]): string | null => {
    for (const item of items) {
      const hay = `${txt(item.title)} ${txt(item.description)}`.toLowerCase();
      const lvl = txt(item.level).toUpperCase();
      if (LEVEL_COLOR[lvl] && aliases.some((a) => hay.includes(a))) {
        return LEVEL_COLOR[lvl];
      }
    }
    return null;
  };

  const sumByKeyword = (kw: string[]) => {
    let total = 0;
    for (const item of items) {
      const hay = `${txt(item.title)} ${txt(item.unit)} ${txt(item.description)}`.toLowerCase();
      if (kw.some((k) => hay.includes(k))) {
        total += num(item.value) || 1;
      }
    }
    return total;
  };

  const stateMatches = items.filter((item) =>
    INDIA_STATES.some((st) => {
      const hay = `${txt(item.title)} ${txt(item.description)}`.toLowerCase();
      return st.aliases.some((a) => hay.includes(a));
    })
  );
  const statesCount = sumByKeyword(["state"]) || stateMatches.length;
  const districtsCount = sumByKeyword(["district"]);
  const villagesCount = sumByKeyword(["village", "gram"]);
  const urbanCount = sumByKeyword(["urban", "city", "town", "metro"]);

  return (
    <article className="cg-site-impact-dash-card">
      <div className="cg-site-impact-dash-head cg-site-impact-geo-head">
        <h3>
          <Users size={17} aria-hidden="true" /> {heading || "Geographical Reach"}
        </h3>
        <div className="cg-site-impact-geo-tabs" role="tablist" aria-label="Geographical view">
          {(["INDIA", "STATES", "DISTRICTS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "cg-geo-tab is-active" : "cg-geo-tab"}
              onClick={() => setTab(t)}
            >
              {t === "INDIA" ? "India" : t === "STATES" ? "States" : "Districts"}
            </button>
          ))}
        </div>
      </div>

      {tab === "INDIA" ? (
        <div className="cg-site-impact-geo-split">
          <svg
            viewBox="0 0 212 234"
            className="cg-site-impact-india-svg"
            role="img"
            aria-label="India geographical reach map"
          >
            {INDIA_STATES.map((st) => {
              const fill = matchStateLevel(st.aliases) ?? "#DCEEE3";
              return (
                <path
                  key={st.id}
                  d={st.d}
                  fill={fill}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                >
                  <title>{st.name}</title>
                </path>
              );
            })}
          </svg>
          <div className="cg-site-impact-geo-right">
            <ul className="cg-site-impact-legend">
              <li>
                <span className="cg-dot is-high" /> High Impact
              </li>
              <li>
                <span className="cg-dot is-med" /> Medium Impact
              </li>
              <li>
                <span className="cg-dot is-exp" /> Expanding
              </li>
            </ul>
            <div className="cg-site-impact-geo-metrics">
              <div>
                <strong>{statesCount}</strong>
                <span>States</span>
              </div>
              <div>
                <strong>{districtsCount}</strong>
                <span>Districts</span>
              </div>
              <div>
                <strong>{villagesCount}</strong>
                <span>Villages</span>
              </div>
              <div>
                <strong>{urbanCount}</strong>
                <span>Urban Locations</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="cg-site-impact-geo-list">
          {(tab === "STATES"
            ? stateMatches.length > 0
              ? stateMatches
              : items
            : items.filter((i) =>
                `${txt(i.title)} ${txt(i.unit)} ${txt(i.description)}`
                  .toLowerCase()
                  .includes("district")
              )
          ).length > 0 ? (
            (tab === "STATES"
              ? stateMatches.length > 0
                ? stateMatches
                : items
              : items.filter((i) =>
                  `${txt(i.title)} ${txt(i.unit)} ${txt(i.description)}`
                    .toLowerCase()
                    .includes("district")
                )
            ).map((v, i) => (
              <div key={i} className="cg-site-impact-geo-item">
                <strong>
                  {txt(v.title)}
                  {num(v.value) > 0 ? ` (${num(v.value)} ${txt(v.unit)})` : ""}
                </strong>
                {txt(v.level) && (
                  <span>
                    {txt(v.level).charAt(0) + txt(v.level).slice(1).toLowerCase()}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="cg-site-impact-empty-inline">
              No {tab === "STATES" ? "state" : "district"} reach published yet.
            </p>
          )}
        </div>
      )}

      {items.length > 0 && sourceNode}
    </article>
  );
}
