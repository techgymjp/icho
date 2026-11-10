// Android アプリ（と GitHub Pages）に載せる Web ファイルを www/ にコピーする
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'howto.html', 'howto-en.html', 'style.css', 'ads.js', 'src', 'vendor']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// アプリ用のビルド（APP_BUILD=1）では、Web 版だけの部分（<!-- web-only --> … <!-- /web-only -->）を取り除く。
// 他社ストアへのリンクなどがアプリのファイルに残らないようにするため（残っていたらビルドを止める）
if (process.env.APP_BUILD === '1') {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const f of walk(out).filter((f) => /\.(html|js|css)$/.test(f) && !f.includes(`${path.sep}vendor${path.sep}`))) {
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(/<!-- web-only -->[\s\S]*?<!-- \/web-only -->\n?/g, '').replace(/\/\/ web-only:start[\s\S]*?\/\/ web-only:end\n?/g, '');
    // アプリのシェア文に入れるストアの URL（SHARE_URL の行）は対象外
    if (/play\.google\.com\/store|web-only/.test(s.replace(/^.*SHARE_URL.*$/gm, ''))) throw new Error(`Web 版だけの部分がアプリ用のファイルに残っています: ${f}`);
    fs.writeFileSync(f, s);
  }
}
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
// 更新したときに古いファイルがブラウザに残らないよう、参照に版番号を付ける（Web 公開用）
if (process.env.CACHE_BUST) {
  const v = process.env.CACHE_BUST;
  const html = path.join(out, 'index.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('src/main.js', `src/main.js?v=${v}`).replace('style.css', `style.css?v=${v}`));
}
console.log(`built web assets into www/ (ads: ${mode}, version: ${version})`);
