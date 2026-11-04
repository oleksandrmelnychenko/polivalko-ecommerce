export function HeroArc({ text }: { text: string }) {
  return (
    <svg className="hero__arc" viewBox="0 0 300 92" aria-hidden="true">
      <g className="hero__arc-text">
        <path id="hero-arc-path" d="M 40 80 A 125 125 0 0 1 260 80" fill="none" />
        <text>
          <textPath href="#hero-arc-path" startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
        <circle cx="26" cy="86" r="2.2" fill="currentColor" />
        <circle cx="274" cy="86" r="2.2" fill="currentColor" />
      </g>
      <g className="hero__arc-stars" fill="currentColor">
        <path d="M118 66l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.5 5-.7z" />
        <path d="M150 58l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1z" />
        <path d="M182 66l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.5 5-.7z" />
      </g>
    </svg>
  );
}
