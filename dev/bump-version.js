#!/usr/bin/env node
// Interactive version bumper for js/game.js.
// Run: npm run bump

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const GAME_JS = path.resolve(__dirname, '../js/game.js');

function parseVersionConsts(src) {
  const map = {};
  for (const [, name, val] of src.matchAll(/^const ([A-Z0-9_]+_VERSION)\s*=\s*"([^"]+)"/gm)) {
    map[name] = val;
  }
  return map;
}

function parseBankRefs(src) {
  const refs = {};
  for (const [, label, vc] of src.matchAll(/label:\s*"([^"]+)"[\s\S]*?versionConst:\s*"([^"]+)"/g)) {
    if (!refs[vc]) refs[vc] = [];
    refs[vc].push(label);
  }
  return refs;
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function printVersions(versions, refs) {
  console.log('\nQuestion bank versions in js/game.js:\n');
  Object.keys(versions).forEach((name, i) => {
    const banks = (refs[name] || []).join(', ');
    const bankStr = banks ? `  ← ${banks}` : '';
    console.log(`  [${i + 1}] ${name} = ${versions[name]}${bankStr}`);
  });
  console.log('\n  Enter just the version tag, e.g.  v0.1.600  (no quotes)');
  console.log('  Enter multiple numbers separated by commas to update several at once.\n');
}

async function main() {
  let src = fs.readFileSync(GAME_JS, 'utf8');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const versions = parseVersionConsts(src);
    const refs = parseBankRefs(src);
    const names = Object.keys(versions);

    if (!names.length) {
      console.error('No *_VERSION constants found in js/game.js');
      rl.close();
      process.exit(1);
    }

    printVersions(versions, refs);

    const choiceStr = await ask(rl, 'Which version(s) to update? (number or comma-list, or q to quit): ');
    if (choiceStr.trim().toLowerCase() === 'q') break;

    const indices = choiceStr.split(',').map(s => parseInt(s.trim(), 10) - 1);
    if (indices.some(i => isNaN(i) || i < 0 || i >= names.length)) {
      console.error('Invalid choice — try again.\n');
      continue;
    }

    for (const idx of indices) {
      const name = names[idx];
      const current = versions[name];
      const raw = (await ask(rl, `New value for ${name} (current: ${current}): `)).trim();
      const newVal = raw.replace(/^"+|"+$/g, ''); // strip accidental surrounding quotes

      if (!newVal) {
        console.log(`  Skipping ${name} (no value entered).`);
        continue;
      }

      src = src.replace(
        new RegExp(`(const ${name}\\s*=\\s*)"[^"]*"`),
        `$1"${newVal}"`
      );
      console.log(`  ${name}: ${current} -> ${newVal}`);
    }

    fs.writeFileSync(GAME_JS, src, 'utf8');
    console.log('\n  js/game.js saved.\n');
  }

  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
