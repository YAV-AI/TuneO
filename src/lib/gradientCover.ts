// Cover art for uploaded audio: a gradient seeded by the song id, so each upload
// gets its own colours and keeps them across reloads.
export function gradientCover(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const hue = Math.floor(rand() * 360);
  const hues = [hue, (hue + 40 + rand() * 60) % 360, (hue + 150 + rand() * 90) % 360].map(Math.round);
  const angle = Math.round(rand() * 360);
  const [cx, cy] = [20 + rand() * 60, 20 + rand() * 60].map(Math.round);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)">
<stop offset="0" stop-color="hsl(${hues[0]} 85% 60%)"/>
<stop offset=".55" stop-color="hsl(${hues[1]} 75% 45%)"/>
<stop offset="1" stop-color="hsl(${hues[2]} 70% 22%)"/>
</linearGradient>
<radialGradient id="r" cx="${cx}%" cy="${cy}%" r="60%">
<stop offset="0" stop-color="hsl(${hues[1]} 95% 80%)" stop-opacity=".65"/>
<stop offset="1" stop-color="hsl(${hues[1]} 95% 80%)" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="512" height="512" fill="url(#g)"/>
<rect width="512" height="512" fill="url(#r)"/>
</svg>`;
}
