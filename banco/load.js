// Carga el núcleo de simulación y los datos reales en Node (sin página). const {Sim, defs, FACTORY} = require('./load')
// CORE=ruta elige otro núcleo (p. ej. el de una versión anterior, para comparar).
const fs = require('fs'), path = require('path');
const dir = '/home/claude/pages/a', f = fs.readdirSync(dir).find(x => /^data\.[0-9a-f]+\.js$/.test(x));
global.window = global.window || {};
const FACTORY = new Function('window', fs.readFileSync(path.join(dir, f), 'utf8') + ';return FACTORY')(global.window);
const Sim = require(process.env.CORE || './sim_core.js');
module.exports = { Sim, DATA: global.window, defs: global.window.REAL_TRACKS, FACTORY };
