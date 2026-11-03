// Silhouettes the home background forms, in order (it cycles through them).
// Each is an SVG path in a 256 x 256 box, filled with the nonzero rule.
// From Phosphor Icons 2.1.1 (https://phosphoricons.com), "fill" weight: bird-fill
// (without its line between wing and body, so the bird is one solid shape),
// detective-fill (a hat and dark glasses), robot-fill and cpu-fill (a chip,
// for technology). MIT License, Copyright (c) 2023 Phosphor Icons; full notice in
// licenses/phosphor-icons.txt. What each one does once formed is in acts.ts.

export interface Shape {
  name: string;
  /** Shown under the shape, formed by letters the same way. */
  caption: string;
  path: string;
  /** Color token for the shape's dense middle; edges are always --color-faint. */
  ink?: string;
}

export const SHAPES: Shape[] = [
  {
    name: 'bird',
    caption: 'Freedom',
    path: 'M236.44,73.34,213.21,57.86A60,60,0,0,0,156,16h-.29C122.79,16.16,96,43.47,96,76.89V96.63L11.63,197.88l-.1.12A16,16,0,0,0,24,224h88A104.11,104.11,0,0,0,216,120V100.28l20.44-13.62a8,8,0,0,0,0-13.32ZM164,80a12,12,0,1,1,12-12A12,12,0,0,1,164,80Z',
  },
  {
    name: 'detective',
    caption: 'Cybersecurity',
    path: 'M256,120a8,8,0,0,1-8,8H8a8,8,0,0,1,0-16H35.92l47.5-65.41a16,16,0,0,1,25.31-.72l12.85,14.9.2.23a7.95,7.95,0,0,0,12.44,0l.2-.23,12.85-14.9a16,16,0,0,1,25.31.72L220.08,112H248A8,8,0,0,1,256,120Zm-76,24a36,36,0,0,0-35.77,32H111.77a36,36,0,1,0-1.83,16h36.12A36,36,0,1,0,180,144Z',
    // Its own ink instead of the accent: near-black on light pages, light steel on the blue home.
    ink: '--color-shade',
  },
  {
    name: 'robot',
    caption: 'Artificial Intelligence',
    path: 'M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48ZM172,96a12,12,0,1,1-12,12A12,12,0,0,1,172,96ZM96,184H80a16,16,0,0,1,0-32H96ZM84,120a12,12,0,1,1,12-12A12,12,0,0,1,84,120Zm60,64H112V152h32Zm32,0H160V152h16a16,16,0,0,1,0,32Z',
  },
  {
    name: 'chip',
    caption: 'Technology',
    path: 'M104,104h48v48H104Zm136,48a8,8,0,0,1-8,8H216v40a16,16,0,0,1-16,16H160v16a8,8,0,0,1-16,0V216H112v16a8,8,0,0,1-16,0V216H56a16,16,0,0,1-16-16V160H24a8,8,0,0,1,0-16H40V112H24a8,8,0,0,1,0-16H40V56A16,16,0,0,1,56,40H96V24a8,8,0,0,1,16,0V40h32V24a8,8,0,0,1,16,0V40h40a16,16,0,0,1,16,16V96h16a8,8,0,0,1,0,16H216v32h16A8,8,0,0,1,240,152ZM168,96a8,8,0,0,0-8-8H96a8,8,0,0,0-8,8v64a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8Z',
    // Silver: light ink instead of the accent.
    ink: '--color-fg',
  },
];
