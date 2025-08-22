const fs = require("fs");
const os = require("os");
const path = require("path");

function getHardwareInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().map((cpu) => cpu.model),
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
  };
}

function saveBenchmarkResults(fileName, data) {
  const filePath = `./results/${fileName}`;
  fs.mkdirSync("./results", { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${filePath}`);
}

function generateHtmlResults(templatePath, outputFileName, data) {
  const template = fs.readFileSync(templatePath, "utf-8");
  const htmlContent = template.replace("{{RESULT_DATA}}", JSON.stringify(data).replace(/</g, "\\u003c").replace(/"/g, '\\"'));
  const outputPath = path.join("./results", outputFileName);
  fs.writeFileSync(outputPath, htmlContent);
  console.log(`HTML results saved to ${outputPath}`);
}

module.exports = {
  getHardwareInfo,
  saveBenchmarkResults,
  generateHtmlResults,
};
