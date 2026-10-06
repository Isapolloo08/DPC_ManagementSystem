import { ChurchCelestial } from './ChurchCelestial';

export function ChurchAmbience() {
  return <>
    <div className="church-ambience" aria-hidden="true">
      <span className="church-sunlight" />
      <span className="church-cloud church-cloud-one" />
      <span className="church-cloud church-cloud-two" />
      <ChurchCelestial />
    </div>
  </>;
}

// The overlay follows the photograph's original coordinate system and scales with it.
export function ChurchLighting() {
  return <svg className="church-lighting" viewBox="0 0 1448 1086" preserveAspectRatio="xMidYMax meet" fill="none" aria-hidden="true" focusable="false">
    <ellipse className="church-cross-halo" cx="490" cy="67" rx="31" ry="53" />
    <path className="church-roof-highlight" d="M247 348L484 117L790 139M813 163L1240 425" />
    <g className="church-window-light">
      <path d="M411 624V423Q429 370 450 416V611Z" />
      <path d="M913 404V365Q925 339 939 367V417Z" />
      <path d="M1008 445V400Q1020 373 1034 407V455Z" />
      <path d="M1091 473V437Q1100 414 1110 444V486Z" />
      <path d="M1149 701V641L1170 649V709Z" />
    </g>
  </svg>;
}
