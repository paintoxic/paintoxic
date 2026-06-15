// Regenerates the Raider.io "fun fact" cards in README.md from the live API.
//
// Single source of truth: .github/raiderio-characters.json
// Add/remove characters there and everything (name, race, class, spec, avatar,
// M+ score, item level) is fetched and rendered — one card (row) per character.
//
// Replaces the block between the RAIDERIO:START / RAIDERIO:END markers.

const fs = require('fs');

const CONFIG = process.env.CONFIG || '.github/raiderio-characters.json';
const README = process.env.README || 'README.md';
const START = '<!-- RAIDERIO:START -->';
const END = '<!-- RAIDERIO:END -->';

// shields.io dynamic badge -> double-encode the API url (shields decodes once)
const badge = (apiUrl, query, label, color) =>
    `https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(apiUrl)}` +
    `&query=${encodeURIComponent(query)}&label=${encodeURIComponent(label)}` +
    `&color=${color}&style=flat-square&logo=battledotnet&logoColor=white`;

async function buildRow(c) {
    const region = String(c.region || 'us').toLowerCase();
    const realmSlug = String(c.realm).toLowerCase().replace(/\s+/g, '-');
    const nameEnc = encodeURIComponent(c.name);
    const profileUrl = `https://raider.io/characters/${region}/${realmSlug}/${nameEnc}`;
    const apiUrl =
        `https://raider.io/api/v1/characters/profile?region=${region}` +
        `&realm=${realmSlug}&name=${nameEnc}` +
        `&fields=gear,mythic_plus_scores_by_season:current`;

    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'profile-readme-updater' } });
    if (!res.ok) throw new Error(`Raider.io API ${res.status} for ${c.name}`);
    const d = await res.json();

    const spec = [d.active_spec_name, d.class].filter(Boolean).join(' ');
    const score = badge(apiUrl, '$.mythic_plus_scores_by_season[0].scores.all', 'Mythic+ Score', 'ff8000');
    const ilvl = badge(apiUrl, '$.gear.item_level_equipped', 'Item Level', 'a335ee');

    return `  <tr>
    <td>
      <a href="${profileUrl}"><img src="${d.thumbnail_url}" width="90" alt="${d.name} avatar" /></a>
    </td>
    <td>
      <b>${d.name}</b> — ${d.race} <b>${spec}</b> @ ${d.realm} (${region.toUpperCase()})<br/><br/>
      <a href="${profileUrl}">
        <img src="${score}" alt="Mythic+ Score" />
        <img src="${ilvl}" alt="Item Level" />
      </a>
    </td>
  </tr>`;
}

async function main() {
    const chars = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    if (!Array.isArray(chars) || chars.length === 0) {
        throw new Error(`No characters in ${CONFIG}`);
    }

    const rows = [];
    for (const c of chars) rows.push(await buildRow(c));

    const card = `${START}
Pushing Mythic+ keys 🗝️

<table>
${rows.join('\n')}
</table>
${END}`;

    const readme = fs.readFileSync(README, 'utf8');
    const re = new RegExp(`${START}[\\s\\S]*?${END}`);
    if (!re.test(readme)) throw new Error('RAIDERIO markers not found in README');
    fs.writeFileSync(README, readme.replace(re, card));
    console.log(`Updated ${chars.length} character card(s): ${chars.map((c) => c.name).join(', ')}`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
