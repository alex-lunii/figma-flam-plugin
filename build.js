const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

if (!fs.existsSync("dist")) fs.mkdirSync("dist");

// Copy ui.html to dist
fs.copyFileSync("src/ui.html", "dist/ui.html");

const buildOptions = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  platform: "browser",
  target: "es6",
  logLevel: "info",
};

if (isWatch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
