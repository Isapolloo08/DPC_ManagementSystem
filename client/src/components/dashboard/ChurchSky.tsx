import { memo, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const stars = Array.from({ length: 512 }, (_, index) => ({
  left: 1 + ((index * 73 + 19) % 97),
  top: .5 + ((index * 41 + 7) % 101) * .97,
  size: index % 9 === 0 ? 2 : index % 3 === 0 ? 1.5 : 1,
}));
const starLayers = ['far', 'near'].map((name, layer) => ({
  name, stars: stars.filter((_, index) => index % 2 === layer),
}));

const SkyStars = memo(function SkyStars() {
  return <span className="church-stars">{starLayers.map(layer => <span key={layer.name} className="church-star-belt" data-layer={layer.name}>
    {[0, 1].map(tile => <span key={tile} className="church-star-tile">{layer.stars.map(({ left, top, size }, index) => <i key={index} style={{
      left: `${left}%`, top: `${top}%`, width: `${size}px`, height: `${size}px`,
      color: index % 5 === 0 ? 'var(--dashboard-gold)' : 'var(--church-star-color)',
    }} />)}</span>)}
  </span>)}</span>;
});

export const ChurchSky = memo(function ChurchSky({ modelVisible, skyRef }: { modelVisible: boolean; skyRef: RefObject<HTMLDivElement | null> }) {
  // Keep the layer mounted so sidebar alignment and drift resume after closing.
  return createPortal(<div ref={skyRef} className="church-dashboard church-dashboard-sky" hidden={modelVisible} aria-hidden="true">
    <span className="church-sky-enter">
    <SkyStars />
    <span className="church-meteors">{[0, 1, 2].map(index => <i key={index} className="church-meteor" style={{ '--meteor-left': `${[70, 90, 45][index]}%`, '--meteor-top': `${[3, 8, 16][index]}%`, animationDelay: `${index}s` } as CSSProperties} />)}</span>
    </span>
  </div>, document.body);
});
