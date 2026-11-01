'use strict';
// Pixel-art badge icons. '#' = badge colour, 'w' = light accent, 'd' = dark accent, '.' = empty.
const BADGE_DEFS = {
  owner: { label: 'Owner', color: '#ffb020', px: [
    '#...#...#',
    '##.###.##',
    '#########',
    '#########',
    '#w#####w#',
    '.#######.'] },
  dev: { label: 'Dev', color: '#7a5cff', px: [
    '...##...##...',
    '..##.....##..',
    '.##.......##.',
    '##.........##',
    '.##.......##.',
    '..##.....##..',
    '...##...##...'] },
  staff: { label: 'Staff', color: '#2fbf8f', px: [
    '#########',
    '#########',
    '####w####',
    '###www###',
    '####w####',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....'] },
  mod: { label: 'Moderator', color: '#4aa3ff', px: [
    '.#####...',
    '#######..',
    '#######..',
    '.#####...',
    '...##....',
    '...##....',
    '...##....',
    '...##....',
    '...##....'] },
  partner: { label: 'Partner', color: '#fc6a39', px: [
    '....#....',
    '....#....',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..##.##..',
    '.##...##.',
    '.#.....#.'] },
  supporter: { label: 'Supporter', color: '#ff5c8a', px: [
    '.###.###.',
    '####w####',
    '#########',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....'] },
  vip: { label: 'VIP', color: '#5ee0e0', px: [
    '..#####..',
    '.#w#####.',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....'] },
  bughunter: { label: 'Bug Hunter', color: '#9be15d', px: [
    '.#.....#.',
    '..#...#..',
    '...###...',
    '#.#####.#',
    '.#######.',
    '#.#####.#',
    '..#####..',
    '...###...'] },
};
const SVGNS = 'http://www.w3.org/2000/svg';
function badgeIcon(id, h) {
  const d = BADGE_DEFS[id]; if (!d) return null;
  const rows = d.px, w = Math.max(...rows.map(r => r.length)), hh = rows.length, H = h || 14;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hh}`); svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true'); svg.style.height = H + 'px'; svg.style.width = (H * w / hh) + 'px';
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    const rc = document.createElementNS(SVGNS, 'rect');
    rc.setAttribute('x', x); rc.setAttribute('y', y); rc.setAttribute('width', 1); rc.setAttribute('height', 1);
    rc.setAttribute('fill', ch === 'w' ? '#ecebf5' : ch === 'd' ? '#14141c' : d.color);
    svg.append(rc);
  }));
  return svg;
}
function badgeRow(list) {
  const row = document.createElement('span'); row.className = 'badges';
  for (const id of list || []) {
    const ic = badgeIcon(id); if (!ic) continue;
    const chip = document.createElement('span'); chip.className = 'bdg'; chip.title = BADGE_DEFS[id].label; chip.setAttribute('role', 'img'); chip.setAttribute('aria-label', BADGE_DEFS[id].label);
    chip.style.setProperty('--bc', BADGE_DEFS[id].color); chip.append(ic); row.append(chip);
  }
  return row;
}