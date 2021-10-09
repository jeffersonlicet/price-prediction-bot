const inquirer = require('inquirer');
const fs = require('fs');
const { error } = require('./utils');

function getConfigFile() {
  try {
    const configFile = fs.readFileSync('./config.json');
    return JSON.parse(configFile);
  } catch (ex) {
    return null;
  }
}

async function generateConfiguration() {
  inquirer
    .prompt([
      {
        type: 'input',
        name: 'configName',
        message: 'Enter a name for your configuration',
        default() {
          return `My Config`;
        },
      },
      {
        type: 'input',
        name: 'amountPerTrade',
        message: 'Enter the amount per position (BNB)',
        default() {
          return `0.001`;
        },
      },
    ])
    .then((res) => {
      console.table(res);
      console.info(`Config saved as ${res.configName}`);

      let existingConfigs;
      let result = [];

      try {
        existingConfigs = fs.readFileSync('config.json', 'utf8');
      } catch {}

      if (existingConfigs) {
        const parsed = JSON.parse(existingConfigs);

        if (parsed.find(({ configName }) => configName === res.configName)) {
          error('Another config exists with the same name');
          return generateConfiguration();
        }

        result.push(...JSON.parse(existingConfigs));
      }

      result.push(res);
      fs.writeFileSync('config.json', JSON.stringify(result), 'utf8');
    });
}

module.exports = { generateConfiguration, getConfigFile };
