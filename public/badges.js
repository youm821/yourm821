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
  creator: { label: 'Creator', color: '#ff6fb5', px: [
    '.....##..',
    '....#w#..',
    '...#w#...',
    '..#w#....',
    '.#w#.....',
    '#d#......',
    '##.......'] },
  og: { label: 'OG', color: '#ffd34d', px: [
    '..#####..',
    '.#w###d#.',
    '.#######.',
    '.#######.',
    '..#####..',
    '...#.#...',
    '...#.#...'] },
  booster: { label: 'Booster', color: '#ff73fa', px: [
    '....#....',
    '...###...',
    '..#####..',
    '....#....',
    '..#.#.#..',
    '..#.#.#..',
    '.#..#..#.'] },
  verified: { label: 'Verified', color: '#4aa3ff', px: [
    '..#####..',
    '.#####w#.',
    '#####w###',
    '##w#w####',
    '###w#####',
    '.#######.',
    '..#####..'] },
  winner: { label: 'Winner', color: '#f5c542', px: [
    '#.#####.#',
    '#.#####.#',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '...###...'] },
  helper: { label: 'Helper', color: '#52d6a0', px: [
    '.##...##.',
    '#w#######',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....'] },
  holiday: { label: 'Holiday', color: '#e5484d', px: [
    '..#...#..',
    '...#.#...',
    '#########',
    '####w####',
    '#########',
    '####w####',
    '#########'] },
  halloween: { label: 'Halloween', color: '#ff8a1f', px: [
    '....#....',
    '.#######.',
    '#########',
    '#d#####d#',
    '#########',
    '#d#d#d#d#',
    '.#######.'] },
};
const BADGE_DESC = {
  owner: 'The site owner.', dev: 'Helps build the site.', staff: 'Part of the team.', mod: 'Keeps the community friendly.',
  partner: 'An official partner.', supporter: 'Supports the project.', vip: 'A very important person.', bughunter: 'Found and reported a bug.',
  creator: 'Had their work approved in the showcase.', og: 'One of the first people here.', booster: 'Boosts the server.',
  verified: 'A verified, real account.', winner: 'Won a contest.', helper: 'Helps other people out.',
  holiday: 'Took part in a holiday event.', halloween: 'Took part in a Halloween event.'
};
const badgeTip = id => (BADGE_DEFS[id] ? BADGE_DEFS[id].label + ': ' + (BADGE_DESC[id] || '') : '');
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
    const chip = document.createElement('span'); chip.className = 'bdg'; chip.title = badgeTip(id); chip.setAttribute('role', 'img'); chip.setAttribute('aria-label', badgeTip(id));
    chip.style.setProperty('--bc', BADGE_DEFS[id].color); chip.append(ic); row.append(chip);
  }
  return row;
}