const inquirer = require('inquirer');
const options = require('./constants/options');
const strategies = require('./constants/strategies');
const backtest = require('./backtest');

const { generateConfiguration, getConfigFile } = require('./config');

const strategySelector = {
  type: 'rawlist',
  name: 'strategy',
  message: 'Select a strategy',
  choices: [
    {
      value: strategies.BIGGER_PAYOUT,
      message: 'More Payout',
      name: 'Bigger Payout',
    },
    {
      value: strategies.MINOR_PAYOUT,
      message: 'Less Payout',
      name: 'Minor Payout',
    },
    {
      value: strategies.ALWAYS_BEAR,
      message: 'alwaysBear',
      name: 'Always Bear',
    },
    {
      value: strategies.ALWAYS_BULL,
      message: 'alwaysBull',
      name: 'Always Bull',
    },
  ],
};

const amountPerPositionSelector = {
  type: 'input',
  name: 'amountPerTrade',
  message: 'Enter the amount per position (BNB)',
  default() {
    return `0.001`;
  },
};

const initialCapitalSelector = {
  type: 'input',
  name: 'capitalAmount',
  message: 'Enter the amount of capital to start (BNB)',
  default() {
    return `1`;
  },
};

const testStrategy = () => {
  inquirer
    .prompt([
      strategySelector,
      initialCapitalSelector,
      amountPerPositionSelector,
    ])
    .then(backtest);
};

(async function init() {
  inquirer
    .prompt([
      {
        type: 'rawlist',
        name: 'action',
        message: '🥞 Pancake Swap Prediction Bot - What do you want to do?',
        choices: [
          {
            type: 'choice',
            value: options.TEST_STRATEGY,
            name: '🧪 Backtest Strategy',
          },
          {
            type: 'choice',
            value: options.START_AUTO_TRADE,
            name: '🔮 Start Auto trade',
            disabled: true,
          },
        ],
      },
    ])
    .then(({ action }) => {
      switch (true) {
        case action === options.TEST_STRATEGY:
          testStrategy();
          break;
      }
    });
})();
