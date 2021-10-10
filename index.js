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
      message: 'Minor Payout',
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
    {
      value: strategies.BOTH_DIRECTIONS,
      message: 'bothDirections',
      name: 'Trade Both Directions',
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

const payoutWeight = {
  type: 'rawlist',
  name: 'payoutToWeight',
  message: 'Select which payout you want to add weight',
  choices: [
    {
      value: 'LESS_PAYOUT',
      message: 'Add weight to minor payout',
      name: 'Add weight to minor payout',
    },
    {
      value: 'BIGGER_PAYOUT',
      message: 'Add weight to bigger payout',
      name: 'Add weight to bigger payout',
    },
  ],
};

const weightValue = {
  type: 'input',
  name: 'weightValue',
  message: 'Multiply selected payout by',
  default() {
    return `2`;
  },
};

const testStrategy = (onDone) => {
  inquirer
    .prompt([
      strategySelector,
      initialCapitalSelector,
      amountPerPositionSelector,
    ])
    .then((settings) => {
      if (settings.strategy === strategies.BOTH_DIRECTIONS) {
        inquirer.prompt([payoutWeight, weightValue]).then((_settings) => {
          backtest({ ...settings, ..._settings }, onDone);
        });
      } else {
        backtest(settings, onDone);
      }
    });
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
          testStrategy(init);
          break;
      }
    });
})();
